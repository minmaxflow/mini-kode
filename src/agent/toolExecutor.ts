/**
 * ========================================================================
 * PERMISSION EXECUTION MODULE
 * ========================================================================
 *
 * This module contains the tool execution logic with permission handling
 * extracted from the main executor. It provides a clean separation between
 * the core agent loop and the permission-based tool execution.
 */

import { applyPermissionGrant } from "../permissions/permissionRequest";
import { runToolBatchConcurrent, executeSingleToolCall } from "../tools/runner";
import { ToolExecutionContext, getToolsByName } from "../tools";
import type { ParsedToolCall } from "../llm/client";
import type {
  ToolCall,
  ToolCallPermissionRequired,
  ToolCallRunning,
  ToolCallPending,
  ToolCallPermissionDenied,
  ToolCallTerminal,
} from "../tools/runner.types";
import { isToolCallTerminal } from "../tools/runner.types";
import type { ExecutionContext, ExecutionCallbacks } from "./types";

/**
 * Execute tools with permission handling and abort support.
 *
 * ========================================================================
 * ASYNC PERMISSION FLOW - CORE IMPLEMENTATION
 * ========================================================================
 *
 * This function is the heart of the async permission system. Here's how the
 * complete flow works from LLM request to UI feedback:
 *
 * 1. VALIDATION PHASE:
 *    - Parse and validate all LLM tool calls
 *    - Prepare ToolCall objects with pending status
 *    - Determine execution strategy (concurrent vs sequential)
 *
 * 2. EXECUTION PHASE:
 *    - Call executeSingleToolCall() which handles permission checking and abort
 *    - Concurrent execution (readonly tools): Execute in parallel with abort support
 *    - Sequential execution (mixed/mutating tools): Execute one-by-one with full state management
 *
 * 3. PERMISSION HANDLING:
 *    - If permission required: ASYNC PAUSE happens here
 *    - onPermissionRequired callback waits for user decision
 *    - User decision flows back through the promise resolution
 *    - **Sequential execution**: Permission denied cascades to remaining tools
 *    - **Concurrent execution**: Readonly tools should never require permission by design
 *
 * 4. ABORT HANDLING:
 *    - **Concurrent execution**: All pending tools are marked as aborted when signal detected
 *    - **Sequential execution**: All remaining tools are marked as aborted when signal detected
 *    - **Individual tools**: Tools check abort signal internally and return abort results
 *    - Abort results are properly formatted with status: "abort"
 *
 * 5. FEEDBACK LOOP:
 *    - onToolStart() called immediately when tool execution begins
 *    - onToolComplete() called when tool finishes (success/error/abort/permission_denied)
 *    - All terminal states are properly tracked and communicated to UI
 *    - LLM sees complete tool result sequence and decides next action
 *
 * KEY BEHAVIOR:
 * - May pause waiting for user approval via onPermissionRequired
 * - Responds immediately to abort signals from user (ESC key)
 * - Results always return in LLM order regardless of execution time
 * - Ensures complete tool message sequences for OpenAI API compliance
 *
 * Strategy:
 * - All readonly tools: Execute concurrently for performance
 * - Mixed or mutating tools: Execute sequentially for data consistency
 * - Always return results in LLM order for stable UI display
 * - Handle abort and permission denied scenarios gracefully
 *
 * @param calls Parsed tool calls from LLM
 * @param context Execution context (includes approval mode and abort signal)
 * @param callbacks Event callbacks (for UI updates)
 * @returns Array of tool execution results in LLM order
 * @returns Includes abort and permission_denied status handling
 */
export async function executeToolsWithPermission(
  calls: ParsedToolCall[],
  context: ExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise<ToolCall[]> {
  if (calls.length === 0) return [];

  // Validate all tools and prepare tool calls
  const toolCallsToExecute: ToolCallPending[] = [];

  const toolsByName = getToolsByName();

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const tool = toolsByName[call.name];

    if (!tool) {
      // Unknown tool - create error result instead of throwing
      toolCallsToExecute.push({
        toolName: call.name,
        requestId: call.id,
        status: "pending" as const,
        input: call.arguments,
        startedAt: new Date().toISOString(),
        unknownTool: true,
      });
      continue;
    }

    toolCallsToExecute.push({
      toolName: call.name,
      requestId: call.id,
      status: "pending" as const,
      input: call.arguments,
      startedAt: new Date().toISOString(),
    });
  }

  // Check if all tools are readonly for concurrent execution
  const allReadonly = toolCallsToExecute.every((tc) => {
    const tool = toolsByName[tc.toolName];
    return tool?.readonly === true;
  });

  if (allReadonly) {
    // CONCURRENT EXECUTION for readonly tools
    return await executeToolsConcurrently(
      toolCallsToExecute,
      context,
      callbacks,
    );
  } else {
    // SEQUENTIAL EXECUTION for batches with mutating tools
    return await executeToolsSequentially(
      toolCallsToExecute,
      context,
      callbacks,
    );
  }
}

/**
 * Execute tools concurrently for readonly tools.
 *
 * Note: readonly tools should never require permission approval by design.
 * This function optimizes for that assumption.
 */
async function executeToolsConcurrently(
  toolCalls: ToolCallPending[],
  context: ExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise<ToolCall[]> {
  const toolContext: ToolExecutionContext = {
    cwd: context.cwd,
    signal: context.signal,
    approvalMode: context.getApprovalMode(),
    sessionId: context.session.sessionId,
  };

  // Notify tool start for all tools before concurrent execution
  // Handle unknown tools separately
  const knownTools: ToolCallPending[] = [];
  const unknownTools: ToolCallPending[] = [];

  for (const toolCall of toolCalls) {
    if (toolCall.unknownTool) {
      unknownTools.push(toolCall);
    } else {
      knownTools.push(toolCall);
    }
  }

  // Process unknown tools immediately with error results
  const unknownToolResults: ToolCall[] = unknownTools.map(toolCall => {
    const executingCall: ToolCallRunning = {
      ...toolCall,
      status: "executing" as const,
    };
    callbacks.onToolStart?.(executingCall);

    const errorResult: ToolCall = {
      ...toolCall,
      status: "error" as const,
      endedAt: new Date().toISOString(),
      result: {
        isError: true,
        message: `Unknown tool: ${toolCall.toolName}`,
      },
    };
    callbacks.onToolComplete?.(errorResult);
    return errorResult;
  });

  // Notify tool start for known tools
  for (const toolCall of knownTools) {
    const executingCall: ToolCallRunning = {
      ...toolCall,
      status: "executing" as const,
    };
    callbacks.onToolStart?.(executingCall);
  }

  // Execute tools concurrently and process results immediately for progressive UI updates
  const results: ToolCall[] = [];
  const requestIdToIndex = new Map<string, number>();

  // Create mapping from requestId to original index for ordering (including unknown tools)
  toolCalls.forEach((toolCall, index) => {
    requestIdToIndex.set(toolCall.requestId, index);
  });

  // Add unknown tool results first
  unknownToolResults.forEach(result => {
    const originalIndex = requestIdToIndex.get(result.requestId)!;
    results[originalIndex] = result;
  });

  // Execute known tools concurrently
  for await (const result of runToolBatchConcurrent(knownTools, toolContext)) {
    // Debug assertion: readonly tools should never require permission
    if (result.status === "permission_required") {
      // For concurrent execution, simplify by throwing an error
      // Permission requests for readonly tools indicate a serious bug
      throw new Error(
        `Readonly tool '${result.toolName}' requested permission approval. This should never happen.`,
      );
    }

    // Find the original index to maintain LLM order
    const originalIndex = requestIdToIndex.get(result.requestId)!;
    results[originalIndex] = result;

    // Call onToolComplete for the final result
    // This ensures the UI gets the terminal state update
    // concurrent execution should only return terminal states
    if (isToolCallTerminal(result)) {
      callbacks.onToolComplete?.(result as ToolCallTerminal);
    }
  }

  return results;
}

/**
 * Execute tools sequentially for batches with mutating tools.
 *
 * This maintains data consistency by executing tools one by one in LLM order.
 */
async function executeToolsSequentially(
  toolCalls: ToolCallPending[],
  context: ExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise<ToolCall[]> {
  const results: ToolCall[] = [];

  for (let i = 0; i < toolCalls.length; i++) {
    const toolCallToExecute = toolCalls[i];

    // Check if this is an unknown tool
    if (toolCallToExecute.unknownTool) {
      // Notify tool start
      const executingCall: ToolCallRunning = {
        ...toolCallToExecute,
        status: "executing" as const,
      };
      callbacks.onToolStart?.(executingCall);

      // Create error result for unknown tool
      const errorResult: ToolCall = {
        ...toolCallToExecute,
        status: "error" as const,
        endedAt: new Date().toISOString(),
        result: {
          isError: true,
          message: `Unknown tool: ${toolCallToExecute.toolName}`,
        },
      };

      results[i] = errorResult;
      callbacks.onToolComplete?.(errorResult);
      continue;
    }

    // Check for abort
    if (context.signal?.aborted) {
      // Mark remaining tools as aborted
      for (let j = i; j < toolCalls.length; j++) {
        const remainingToolCall = toolCalls[j];
        const abortedResult: ToolCall = {
          ...remainingToolCall,
          status: "abort",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          result: {
            isError: true,
            isAborted: true,
            message: "Tool execution was interrupted by user",
          },
        };
        results[j] = abortedResult;
        // Notify UI about abort
        callbacks.onToolComplete?.(abortedResult as ToolCallTerminal);
      }
      break;
    }

    // Notify tool start
    const executingCall: ToolCallRunning = {
      ...toolCallToExecute,
      status: "executing" as const,
    };
    callbacks.onToolStart?.(executingCall);

    // Execute single tool
    const toolResult = await executeSingleToolWithPermission(
      toolCallToExecute,
      context,
      callbacks,
    );

    results[i] = toolResult;
    // Call onToolComplete for the final result
    // This ensures the UI gets the terminal state update
    // Only call for terminal states
    if (isToolCallTerminal(toolResult)) {
      callbacks.onToolComplete?.(toolResult as ToolCallTerminal);
    }

    // If permission was denied, stop execution and mark remaining tools as permission_denied
    if (toolResult.status === "permission_denied") {
      for (let j = i + 1; j < toolCalls.length; j++) {
        const remainingToolCall = toolCalls[j];
        // Create permission_denied tool call without result field
        const deniedResult: ToolCallPermissionDenied = {
          ...remainingToolCall,
          status: "permission_denied" as const,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        };
        results[j] = deniedResult;
        // Notify UI about permission denied
        callbacks.onToolComplete?.(deniedResult);
      }
      break;
    }
  }

  return results;
}

/**
 * Execute a single tool with permission handling.
 */
async function executeSingleToolWithPermission(
  toolCallToExecute: ToolCallPending,
  context: ExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise<ToolCall> {
  const toolContext: ToolExecutionContext = {
    cwd: context.cwd,
    signal: context.signal,
    approvalMode: context.getApprovalMode(),
    sessionId: context.session.sessionId,
  };

  // Execute tool directly using the dedicated single tool function
  const result = await executeSingleToolCall(toolCallToExecute, toolContext);

  if (result.status === "permission_required") {
    // Handle permission request
    // Create permission_required tool call without result field
    const permissionRequiredCall: ToolCallPermissionRequired = {
      ...toolCallToExecute,
      status: "permission_required" as const,
      uiHint: result.uiHint!,
    };
    const finalResult = await handlePermissionRequest(
      permissionRequiredCall,
      toolContext,
      callbacks,
    );
    return finalResult;
  } else {
    return result;
  }
}

/**
 * Handle permission requests for a single tool.
 *
 * This centralizes permission handling logic that was previously duplicated.
 * Processes one tool call at a time, requiring explicit user approval for each.
 */
async function handlePermissionRequest(
  toolCallToExecute: ToolCallPermissionRequired,
  toolContext: ToolExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise<ToolCall> {
  const uiHint = toolCallToExecute.uiHint;

  if (!callbacks.onPermissionRequired) {
    // No callback available, return permission_denied status
    // Create permission_denied tool call without result field
    const deniedResult: ToolCallPermissionDenied = {
      ...toolCallToExecute,
      status: "permission_denied" as const,
      endedAt: new Date().toISOString(),
    };
    return deniedResult;
  }

  // Update UI to show permission prompt before asking for permission
  // This ensures the tool call is in the correct state when onPermissionRequired is called
  if (callbacks.onToolUpdate) {
    // Create permission_required tool call without result field
    const permissionRequiredCall: ToolCallPermissionRequired = {
      ...toolCallToExecute,
      status: "permission_required" as const,
      uiHint,
    };
    callbacks.onToolUpdate?.(permissionRequiredCall);
  }

  const decision = await callbacks.onPermissionRequired(
    uiHint,
    toolCallToExecute.requestId,
  );
  if (!decision.approved) {
    // Return permission_denied status instead of throwing
    // Create permission_denied tool call without result field
    const deniedResult: ToolCallPermissionDenied = {
      ...toolCallToExecute,
      status: "permission_denied" as const,
      endedAt: new Date().toISOString(),
      rejectionReason: decision.reason,
    };
    return deniedResult;
  }

  await applyPermissionGrant(uiHint, decision.option, toolContext.cwd);

  // Update UI to show tool is now executing (after permission granted)
  // This ensures users see the transition from permission prompt to execution
  // Note: This is important for the UI to show the correct tool status
  // Use onToolUpdate for non-terminal state changes (permission_required -> executing)
  if (callbacks.onToolUpdate) {
    const executingCall: ToolCallRunning = {
      ...toolCallToExecute,
      status: "executing" as const,
      startedAt: new Date().toISOString(),
    };
    callbacks.onToolUpdate?.(executingCall);
  }

  // Retry the single tool execution after permission grant
  const retryResult = await executeSingleToolCall(
    toolCallToExecute,
    toolContext,
  );
  return retryResult;
}

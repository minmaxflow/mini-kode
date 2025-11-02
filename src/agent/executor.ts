/**
 * ========================================================================
 * COMPLETE ASYNC PERMISSION FLOW OVERVIEW
 * ========================================================================
 *
 * This file is the core coordinator of the async permission system. The complete
 * permission flow spans multiple layers from LLM to UI. Here's the detailed flow:
 *
 * 📋 DETAILED STEP-BY-STEP FLOW:
 *
 * 1. LLM REQUEST:
 *    - LLM decides to call tools (e.g., "edit file", "run command")
 *    - Tools are parsed in executor.ts as ParsedToolCall[]
 *    - Executor calls executeToolsWithPermission() to begin processing
 *
 * 2. EXECUTOR VALIDATION & TOOL EXECUTION:
 *    - Each tool is validated and prepared for execution
 *    - Executor calls executeSingleToolCall() for each tool via tools/runner.ts
 *    - Tool's execute() method is called with execution context
 *
 * 3. PERMISSION CHECKING (TOOL LAYER):
 *    - Each tool internally checks permissions using approvalMode context
 *    - Tools call functions like checkFsPermission() or checkBashApproval()
 *    - If permission required, tool throws PermissionRequiredError with uiHint
 *    - tools/runner.ts catches PermissionRequiredError and converts it to
 *      "permission_required" status that the UI can understand
 *
 * 4. ASYNC PERMISSION REQUEST:
 *    - Executor detects "permission_required" status from tool execution result
 *    - Executor calls onPermissionRequired callback and asynchronously waits for user decision
 *    - User decision (approved/rejected) is returned via the callback promise
 *
 * 5. EXECUTION CONTINUES OR STOPS:
 *    - If approved: Permission grant is applied and tool executes normally
 *    - If rejected: Permission request returns "permission_denied" status
 *    - Results (success/error) are returned to LLM in proper order
 *
 * 6. UI UPDATES & LOOP COMPLETION:
 *    - onToolComplete callback updates UI with final tool status
 *    - User sees tool execution progress in real-time
 *    - All tool results are added to conversation history
 *    - LLM receives results and decides next action (more tools or final response)
 *
 * 🔄 KEY ASYNC COORDINATION:
 *
 * ASYNC PERMISSION FLOW:
 * - onPermissionRequired callback asynchronously waits for user decision
 * - Tools requiring permission are always executed sequentially, never concurrently
 * - Each permission request waits for user approval before proceeding
 *
 * 🔴 ERROR HANDLING MODEL:
 *
 * DUAL ERROR COMMUNICATION:
 * 1. onLLMMessageUpdate(message: LLMMessage) - Detailed error with OpenAIError
 *    - Sent immediately when LLM streaming fails
 *    - Contains full OpenAIError with status, headers, message
 *    - UI can display rich error information (rate limit, auth, etc.)
 *    - Includes APIUserAbortError when user cancels
 *
 * 2. ExecutionResult.error - Simple error type for exit code
 *    - Used by non-interactive mode to determine exit code
 *    - Types:
 *      • permission_denied (exit 1) - User rejected permission
 *      • llm_error (exit 2) - OpenAIError (rate limit, auth, network, etc.)
 *      • aborted (exit 3) - APIUserAbortError (user pressed Ctrl+C)
 *      • internal_error (exit 4) - Internal program error (validation, logic errors, etc.)
 *    - Note: Tool execution errors don't fail the whole execution
 *
 * ========================================================================
 * Agent Executor
 * ========================================================================
 *
 * Core agent execution engine that handles the LLM + tool calling loop.
 * This is UI-agnostic and can be used by both interactive and non-interactive modes.
 *
 * Architecture:
 * - Pure business logic, no UI dependencies
 * - Uses callbacks for event handling
 * - Supports approval mode override
 * - Handles permission requests via callback
 */

import { APIUserAbortError, OpenAIError } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources";

import {
  createClient,
  streamChatCompletion,
  StreamingResponse,
  type TokenUsage,
} from "../llm/client";
import { formatToolResultMessage } from "./formatters";

import { executeToolsWithPermission } from "./toolExecutor";
import { allToolsToOpenAIFormat } from "../tools/openai";
import { getAllTools } from "../tools";
import { buildSystemMessage } from "./context";
import type {
  ExecutionContext,
  ExecutionCallbacks,
  ExecutionResult,
} from "./types";
import { LLMMessage, toOpenAIMessages } from "../sessions/types";
import { validateMessageSequence } from "../sessions/validation";
import { ChatFinishReason } from "../llm/types";
import { buildSummaryPrompt } from "../utils/summary";

// No hard iteration limit - LLM can stop naturally with finish_reason: 'stop'
// User can abort at any time via AbortController
// Complex tasks may require many iterations

// Token tracking and compression constants
const COMPRESSION_THRESHOLD = 115000; // 90% of 128K

function shouldTriggerCompression(tokenUsage: TokenUsage): boolean {
  return tokenUsage.total_tokens > COMPRESSION_THRESHOLD;
}

async function triggerAutomaticCompression(
  conversationHistory: ChatCompletionMessageParam[],
  context: ExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise<ChatCompletionMessageParam[]> {
  // Create auto-triggered compact command call for UI
  const startedAt = new Date().toISOString();
  const callId = `/compact_auto_${Date.now()}`;
  const commandCall = {
    kind: "cmd" as const,
    commandName: "/compact" as const,
    callId,
    status: "executing" as const,
    startedAt,
    autoTriggered: true,
  };

  // Notify UI to add the auto-compact command call
  callbacks.onAddCommandCall?.(commandCall);

  try {
    // Skip only the system message (first message) for compression
    // Keep all user, assistant, and tool messages for context
    const llmMessages = conversationHistory.slice(1);

    // Build summary prompt using shared utility
    const summaryPrompt = buildSummaryPrompt(
      llmMessages.map((msg) => ({
        kind: "api" as const,
        status: "complete" as const,
        message: msg,
      })),
    );

    const client = createClient({ cwd: context.cwd });
    const stream = streamChatCompletion(
      client,
      [
        {
          role: "user" as const,
          content: summaryPrompt,
        },
      ],
      {
        signal: context.signal,
      },
    );

    let summaryContent = "";
    let compressionTokenUsage: TokenUsage | undefined;
    for await (const response of stream) {
      const content =
        typeof response.completeMessage.content === "string"
          ? response.completeMessage.content
          : "";
      summaryContent = content;

      // Capture token usage from the compression request
      if (response.tokenUsage) {
        compressionTokenUsage = response.tokenUsage;
      }

      if (response.isComplete) {
        break;
      }
    }

    // Complete command call with success
    const completedCall = {
      ...commandCall,
      status: "success" as const,
      endedAt: new Date().toISOString(),
      result: summaryContent as string | undefined,
    };
    callbacks.onCompleteCommandCall?.(completedCall);

    // Create new conversation history with system message and summary
    const systemMessage = conversationHistory[0]; // Keep system message
    const summaryMessage: ChatCompletionMessageParam = {
      role: "user",
      content: `[Auto-compressed conversation summary]\n\n${summaryContent}`,
    };

    // Update token usage after compression
    // Use actual compression token usage if available, otherwise reset to 0
    const updatedTokenUsage = compressionTokenUsage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    callbacks.onTokenUsageUpdate?.(updatedTokenUsage);

    // Return new conversation history
    return [systemMessage, summaryMessage];
  } catch (error) {
    // Complete command call with error
    const errorCall = {
      ...commandCall,
      status: "error" as const,
      endedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
    callbacks.onCompleteCommandCall?.(errorCall);

    // Return original conversation history if compression fails
    return conversationHistory;
  }
}

/**
 * Execute an agent task with the given prompt.
 *
 * This is the core agent loop that:
 * 1. Sends prompt to LLM with tool descriptions
 * 2. Streams LLM response (text or tool calls)
 * 3. If has tool calls: Execute tools, add results to conversation, repeat from step 1
 * 4. If only text: Return as final response
 * 5. Handles permission requests via callback
 *
 * @param prompt User's prompt/instruction
 * @param context Execution context (cwd, signal, approvalMode override, session)
 * @param callbacks Event callbacks for streaming, tools, permissions
 * @returns Execution result with success status and response/error
 *
 * @example
 * ```typescript
 * const result = await executeAgent('Fix the bug in auth.ts', {
 *   cwd: '/project',
 *   signal: abortSignal,
 *   approvalMode: 'yolo',
 *   session: createSession()
 * }, {
 *   onComplete: (response) => console.log('Done:', response)
 * });
 *
 * if (result.success) {
 *   console.log(result.response);
 * } else {
 *   console.error(result.error?.message);
 * }
 * ```
 */
export async function executeAgent(
  prompt: string,
  context: ExecutionContext,
  callbacks: ExecutionCallbacks = {},
): Promise<ExecutionResult> {
  const { cwd, signal } = context;

  const client = createClient({ cwd });

  // Use existing session if provided, otherwise create a temporary one
  const session = context.session;
  const sessionId = session.sessionId;

  // Build initial conversation context
  const systemMessage = await buildSystemMessage(cwd);

  // Combine system message, session messages, and current prompt
  const userPromptMessage = { role: "user" as const, content: prompt };
  let conversationHistory: ChatCompletionMessageParam[] = [
    systemMessage,
    ...toOpenAIMessages(session.messages),
    userPromptMessage,
  ];

  const openaiTools = allToolsToOpenAIFormat(getAllTools());

  try {
    let iteration = 0;

    while (true) {
      iteration++;

      // Notify UI that LLM generation is starting
      callbacks.onGeneratingChange?.(true);

      // Validate message sequence before sending to LLM
      // This ensures OpenAI API compliance and provides clear error messages
      const validation = validateMessageSequence(conversationHistory);
      if (!validation.valid) {
        const errorMessage = `Message validation failed: ${validation.errors.join("; ")}`;
        throw new Error(errorMessage);
      }

      // Stream LLM response
      const stream = streamChatCompletion(client, conversationHistory, {
        signal,
        tools: openaiTools,
      });

      let assembled = "";
      let finishReason: ChatFinishReason = null;
      let lastResponse: StreamingResponse | null = null;

      // Process streaming responses with complete messages
      try {
        for await (const response of stream) {
          lastResponse = response;

          // Extract content from the complete message (already accumulated by streamChatCompletion)
          const content =
            typeof response.completeMessage.content === "string"
              ? response.completeMessage.content
              : "";

          assembled = content;

          // Notify UI with streaming update
          const streamingLLMMessage: LLMMessage = {
            kind: "api",
            status: response.isComplete ? "complete" : "streaming",
            message: response.completeMessage,
          };
          callbacks.onLLMMessageUpdate?.(streamingLLMMessage);

          if (response.isComplete) {
            finishReason = response.finishReason || null;
          }
        }
      } catch (err) {
        // Only handle OpenAI errors here - save partial message to session
        if (err instanceof OpenAIError) {
          // Only notify UI if we have a valid partial message
          // If there's no lastResponse?.completeMessage, we have nothing meaningful to show
          if (lastResponse?.completeMessage) {
            // Notify UI to replace streaming message with error message
            callbacks.onLLMMessageUpdate?.({
              kind: "api",
              status: "error",
              message: lastResponse.completeMessage,
              error: err,
            });
          }
        }

        // Re-throw all errors to be handled by outer catch block
        // So we can end the execution loop and return the error to the caller
        throw err;
      }

      // Get parsed tool calls directly from streaming response
      const parsedCalls = lastResponse?.parsedToolCalls || [];

      // Update token usage from the LLM response
      if (
        lastResponse?.tokenUsage &&
        lastResponse.tokenUsage.total_tokens > 0
      ) {
        // Update UI state with current token usage
        callbacks.onTokenUsageUpdate?.(lastResponse.tokenUsage);
      }

      // Add assistant's message to conversation
      // Use the complete message from streaming response which already has proper format
      if (lastResponse) {
        conversationHistory.push(lastResponse.completeMessage);
      }

      // Branch based on finish reason
      if (finishReason === "tool_calls" && parsedCalls.length > 0) {
        // LLM wants to call tools

        // Execute tools with permission handling
        const toolCalls = await executeToolsWithPermission(
          parsedCalls,
          context,
          callbacks,
        );

        // Only add tool results to conversation if the tool was finished.
        // Add tool results to conversation (for LLM context in next iteration)
        // Note: Tool messages are automatically added to UI by COMPLETE_TOOL_CALL action
        // so we don't need to call onLLMMessageUpdate here
        for (let i = 0; i < parsedCalls.length; i++) {
          const toolCall = toolCalls[i];
          if (toolCall) {
            const toolMessage = formatToolResultMessage(toolCall);
            conversationHistory.push(toolMessage);
          }
        }

        // Check for permission_denied status in tool results
        // Note: abort status is only relevant for Interactive mode with UI
        // Non-Interactive mode doesn't have user-triggered aborts
        const hasPermissionDenied = toolCalls.some(
          (toolCall) => toolCall.status === "permission_denied",
        );

        // If any tool was rejected by user, end execution
        if (hasPermissionDenied) {
          // Ensure UI state is updated when execution ends due to permission denied
          callbacks.onGeneratingChange?.(false);
          return {
            success: false,
            error: {
              type: "permission_denied",
              message: "Rejected by user",
            },
          };
        }

        // Check if we need to trigger automatic compression after tool execution
        if (
          lastResponse?.tokenUsage &&
          shouldTriggerCompression(lastResponse.tokenUsage)
        ) {
          conversationHistory = await triggerAutomaticCompression(
            conversationHistory,
            context,
            callbacks,
          );
        }

        // Continue loop - let LLM see tool results and decide next action
        continue;
      }

      // Check if we need to trigger automatic compression after text response
      if (
        lastResponse?.tokenUsage &&
        shouldTriggerCompression(lastResponse.tokenUsage)
      ) {
        conversationHistory = await triggerAutomaticCompression(
          conversationHistory,
          context,
          callbacks,
        );
      }

      // Ensure UI state is updated when LLM generation completes successfully
      callbacks.onGeneratingChange?.(false);

      callbacks.onComplete?.(assembled);

      return {
        success: true,
        response: assembled,
      };
    }
  } catch (err) {
    // 1. Error classification
    // Note: permission_denied errors are handled internally and don't reach this catch block
    let errorType: "aborted" | "llm_error" | "internal_error" =
      "internal_error";
    let errorMessage = err instanceof Error ? err.message : String(err);

    if (err instanceof APIUserAbortError) {
      errorType = "aborted";
    } else if (err instanceof OpenAIError) {
      errorType = "llm_error";
    }

    // 3. Call callbacks.onGeneratingChange to ensure UI state is updated
    // This is especially important for aborts to ensure isLLMGenerating is set to false
    callbacks.onGeneratingChange?.(false);

    // 4. Call callbacks.onError - but NOT for user-initiated aborts
    // User abort is not an error, it's an intentional user action
    // We don't want to show error messages for user-initiated aborts in the UI
    if (errorType !== "aborted") {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      callbacks.onError?.(errorObj);
    }

    // 5. Return final result
    return {
      success: false,
      error: {
        type: errorType,
        message: errorMessage,
        cause: err,
      },
    };
  }
}

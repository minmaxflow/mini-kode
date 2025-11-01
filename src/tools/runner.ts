import { ToolExecutionContext, getToolsByName } from "./index";
import type { ToolCall } from "./runner.types";
import { PermissionRequiredError } from "./types";

/**
 * This function handles the lowest level of tool execution and permission
 * error conversion. It's part of the async permission flow documented in
 * src/agent/executor.ts.
 *
 * KEY RESPONSIBILITY:
 * - Convert PermissionRequiredError from tools into "permission_required" status
 * - This bridges tool-level permission checking with the UI permission system
 * - Does NOT handle user approval - that happens at higher levels in executor
 *
 * @param toolCall The tool call containing tool, input, and metadata
 * @param execContext Execution context (cwd, signal, approvalMode)
 * @param startedAt ISO timestamp when execution started
 * @returns ToolCall with updated status and result/error/permission_required/cancelled
 */
async function executeSingleTool(
  toolCall: ToolCall,
  execContext: ToolExecutionContext,
  startedAt: string,
): Promise<ToolCall> {
  const nowIso = () => new Date().toISOString();

  try {
    // Get the tool instance from the tool name
    const toolsByName = getToolsByName();
    const tool = toolsByName[toolCall.toolName]!;

    // cast input to any to avoid type errors
    const result = await tool.execute(toolCall.input as any, execContext);

    // Check if tool returned a business logic error
    if ("isError" in result && result.isError === true) {
      // Check if this is an abort result
      const isAborted = "isAborted" in result && result.isAborted === true;

      if (isAborted) {
        return {
          ...toolCall,
          status: "abort",
          startedAt,
          endedAt: nowIso(),
          result,
        };
      } else {
        return {
          ...toolCall,
          status: "error",
          startedAt,
          endedAt: nowIso(),
          result,
        };
      }
    }

    return {
      ...toolCall,
      status: "success",
      startedAt,
      endedAt: nowIso(),
      result,
    };
  } catch (err: any) {
    if (err instanceof PermissionRequiredError) {
      return {
        ...toolCall,
        status: "permission_required",
        startedAt,
        endedAt: nowIso(),
        uiHint: err.uiHint,
        result: undefined,
      };
    }
    return {
      ...toolCall,
      status: "error",
      startedAt,
      endedAt: nowIso(),
      result: {
        isError: true,
        message: String(err?.message ?? "Execution error"),
      },
    };
  }
}

/**
 * Execute tool calls concurrently (for readonly tools)
 *
 * @param toolCalls Array of tool calls to execute
 * @param context Execution context (working directory, abort signal)
 * @yields ToolCall - Yields each result as soon as it completes
 */
export async function* runToolBatchConcurrent(
  toolCalls: Array<ToolCall>,
  context: ToolExecutionContext,
): AsyncGenerator<ToolCall, void, unknown> {
  const nowIso = () => new Date().toISOString();
  const startedAt = nowIso();

  // Create a Promise for each tool in the batch
  const wrapped = toolCalls.map((tc, j) =>
    (async () => {
      const res = await executeSingleTool(tc, context, startedAt);
      return { j, res };
    })(),
  );

  // Track pending tool indices using simple array
  let pendingIndices = Array.from({ length: wrapped.length }, (_, i) => i);

  // Loop until all tools complete
  while (pendingIndices.length > 0) {
    // Check for abort signal before waiting
    if (context.signal?.aborted) {
      // Mark all pending tools as aborted
      for (const index of pendingIndices) {
        const toolCall = toolCalls[index];
        yield {
          ...toolCall,
          status: "abort",
          startedAt,
          endedAt: nowIso(),
          result: {
            isError: true,
            isAborted: true,
            message: "Tool execution was aborted",
          },
        };
      }

      // Cleanup remaining promises
      const pendingPromises = pendingIndices.map((j) => wrapped[j]);
      Promise.allSettled(pendingPromises).catch(() => {
        // Ignore errors from cleanup
      });
      return;
    }

    // Wait for the first promise to complete
    const pendingPromises = pendingIndices.map((j) => wrapped[j]);
    const { j, res } = await Promise.race(pendingPromises);
    pendingIndices = pendingIndices.filter((index) => index !== j);
    yield res;
  }
}

/**
 * Execute a single tool call directly.
 *
 * This is a convenience function for executing a single tool without array overhead.
 *
 * @param toolCall Single tool call to execute
 * @param context Execution context
 * @returns Tool execution result
 */
export async function executeSingleToolCall(
  toolCall: ToolCall,
  context: ToolExecutionContext,
): Promise<ToolCall> {
  const startedAt = new Date().toISOString();
  return await executeSingleTool(toolCall, context, startedAt);
}

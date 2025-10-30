/**
 * Message Formatters
 *
 * Provides helper functions for formatting tool results as OpenAI messages.
 */

import type { ChatCompletionToolMessageParam } from "openai/resources";

import type { ToolCall } from "../tools/runner.types";

/**
 * Format a single tool result as OpenAI tool message
 *
 * Tool messages represent the results of tool executions and are sent
 * back to the LLM to continue the conversation.
 *
 * @param result The tool execution result
 * @returns OpenAI message object for tool response
 */
export function formatToolResultMessage(
  result: ToolCall,
): ChatCompletionToolMessageParam {
  // Format the result content based on status
  let content: string;

  if (result.status === "success" && result.result) {
    // Serialize successful result
    content = JSON.stringify(result.result, null, 2);
  } else if (
    result.status === "error" &&
    result.result &&
    "isError" in result.result
  ) {
    // Format error message from result
    content = `Error: ${result.result.message}`;
  } else if (result.status === "abort") {
    // Format abort message
    content = `${result.result ? JSON.stringify(result.result, null, 2) : ""}\n\n[Interrupted by User]`;
  } else if (result.status === "permission_denied") {
    // Format permission denied message
    content = `${result.toolName} was rejected by user`;
  } else {
    // this should never happen, as we only send success, error, abort, and permission_denied tool results
    throw new Error(`Unexpected tool result status: ${result.status}`);
  }

  return {
    role: "tool",
    tool_call_id: result.requestId,
    content,
  };
}

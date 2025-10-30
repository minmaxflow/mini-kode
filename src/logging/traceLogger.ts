/**
 * Trace Logger - Complete Agent Execution Flow
 *
 * This logger provides a comprehensive trace view of the entire agent execution,
 * making it easy to debug and understand the complete flow:
 *
 * - Agent loop lifecycle (start, end)
 * - LLM requests (full message history)
 * - LLM responses (content, tool_calls, finish_reason)
 * - Tool executions (input, permission checks, results)
 * - User interactions (approvals, rejections)
 *
 * All logs go to trace.log with consistent formatting for easy reading.
 */

import type { ChatCompletionMessageParam } from "openai/resources";

import { logDebug } from "./logger";
import type { ParsedToolCall } from "../llm/client";
import type { ToolCall } from "../tools/runner.types";
import { PermissionUiHint } from "../tools/types";
import { PermissionOption } from "../tools/permissionRequest";
/**
 * ==========================================
 * AGENT LOOP TRACING
 * ==========================================
 */

export function traceAgentStart(sessionId: string) {
  logDebug("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logDebug("[AGENT] Start", {
    sessionId,
  });
  logDebug("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

export function traceAgentEnd(
  sessionId: string,
  finalResponse: string,
  reason: "completed" | "permission_denied",
) {
  logDebug("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logDebug("[AGENT] End", {
    sessionId,
    reason,
    finalResponse,
  });
  logDebug("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

export function traceAgentError(
  sessionId: string,
  errorType: "aborted" | "llm_error" | "internal_error",
  error: Error | unknown,
) {
  logDebug("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const errorInfo =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          stack: error.stack,
        }
      : {
          message: String(error),
        };
  logDebug("[AGENT] Error", {
    sessionId,
    errorType,
    errorInfo,
  });
  logDebug("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

/**
 * ==========================================
 * LLM REQUEST/RESPONSE TRACING
 * ==========================================
 */

export function traceLLMRequest(messages: ChatCompletionMessageParam[]) {
  logDebug("[LLM] → Request:", messages);
}

export function traceLLMResponse(
  content: string,
  toolCalls: ParsedToolCall[],
  finishReason: string | null,
) {
  // Log complete assistant message in OpenAI format
  const assistantMessage: Omit<ChatCompletionMessageParam, "tool_calls"> & {
    tool_calls?: ParsedToolCall[];
    finish_reason: string | null;
  } = {
    role: "assistant",
    content: content || null,
    finish_reason: finishReason,
  };

  if (toolCalls && toolCalls.length > 0) {
    assistantMessage.tool_calls = toolCalls;
  }

  logDebug("[LLM] ← Assistant Message:", assistantMessage);
}

/**
 * ==========================================
 * TOOL EXECUTION TRACING
 * ==========================================
 */

export function traceToolStart(
  requestId: string,
  toolName: string,
  input: Record<string, unknown>,
) {
  logDebug("[TOOL] ⚙ Start", {
    requestId,
    toolName,
    input,
  });
}

export function traceToolPermissionRequired(
  requestId: string,
  toolName: string,
  permissionHint: PermissionUiHint,
) {
  logDebug("[TOOL] 🔒 Permission Required", {
    requestId,
    toolName,
    kind: permissionHint.kind,
    details:
      permissionHint.kind === "fs"
        ? { path: permissionHint.path }
        : { command: permissionHint.command },
  });
}

export function traceToolPermissionGranted(
  requestId: string,
  toolName: string,
  option: PermissionOption,
) {
  logDebug("[TOOL] ✓ Permission Granted", {
    requestId,
    toolName,
    option,
  });
}

export function traceToolPermissionRejected(
  requestId: string,
  toolName: string,
) {
  logDebug("[TOOL] ✗ Permission Rejected", {
    requestId,
    toolName,
  });
}

export function traceToolResult(
  requestId: string,
  toolName: string,
  result: ToolCall,
) {
  const logData = {
    requestId,
    toolName,
    status: result.status,
    duration:
      result.endedAt && result.startedAt
        ? new Date(result.endedAt).getTime() -
          new Date(result.startedAt).getTime()
        : undefined,
  };

  if (result.status === "success") {
    logDebug("[TOOL] ✓ Success", {
      ...logData,
      result: result.result,
    });
  } else if (result.status === "error") {
    logDebug("[TOOL] ✗ Error", {
      ...logData,
      result: result.result,
    });
  } else if (result.status === "abort") {
    logDebug("[TOOL] ⊘ Aborted", logData);
  }
}

/**
 * ==========================================
 * USER INTERACTION TRACING
 * ==========================================
 */

export function traceUserApproval(requestId: string, option: string) {
  logDebug("[USER] ✓ Approved", {
    requestId,
    option,
  });
}

export function traceUserRejection(requestId: string) {
  logDebug("[USER] ✗ Rejected", {
    requestId,
  });
}

export function traceUserAbort(sessionId: string) {
  logDebug("[USER] ⊗ Aborted", {
    sessionId,
  });
}

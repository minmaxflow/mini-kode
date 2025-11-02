import type { PermissionUiHint } from "../permissions/types";

export type { PermissionUiHint };

/**
 * ========================================================================
 * Tool Call Status - Lifecycle State Machine
 * ========================================================================
 *
 * A ToolCall progresses through distinct lifecycle phases:
 *
 * TRANSIENT STATES (can transition to other states):
 * - pending: Tool is queued but not yet started
 * - executing: Tool is currently running
 * - permission_required: Tool needs user approval to proceed
 *
 * TERMINAL STATES (final, immutable):
 * - success: Tool completed successfully, result available
 * - error: Tool failed with an error
 * - abort: Tool was cancelled by user (Ctrl+C / ESC)
 * - permission_denied: User rejected permission request
 *
 * STATE TRANSITIONS:
 *
 * pending → executing → success
 *        ↓           ↘ error
 *        ↓           ↘ abort (signal detected)
 *        ↓
 *        → permission_required → executing (after approval)
 *                              ↘ permission_denied (rejected)
 *                              ↘ abort (cancelled while waiting)
 *        ↓
 *        → abort (cancelled before start)
 *
 * CRITICAL INVARIANTS:
 *
 * 1. Terminal states are IMMUTABLE
 *    - Once a tool reaches a terminal state, its status cannot change
 *    - This prevents race conditions between executor and UI updates
 *
 * 2. Terminal states have tool messages
 *    - Every terminal state MUST have a corresponding tool message added
 *      to conversationHistory for OpenAI API
 *    - This ensures message sequence integrity
 *
 * 3. Only transient states can be aborted
 *    - Abort only affects tools in pending/executing/permission_required
 *    - Tools in terminal states are left unchanged
 *
 * ARCHITECTURE IMPLICATIONS:
 *
 * - executor: Owns terminal state transitions and message additions
 * - UI: Can only abort transient states, cannot modify terminal states
 * - Message deduplication: Check terminal status before adding abort messages
 *
 * ========================================================================
 */

/**
 * Transient states - tool execution is in progress and can be cancelled
 */
export type ToolCallTransientStatus =
  | "pending"
  | "executing"
  | "permission_required";

/**
 * Terminal states - tool execution has completed and status is final
 */
export type ToolCallTerminalStatus =
  | "success"
  | "error"
  | "abort"
  | "permission_denied";

/**
 * All possible tool call statuses
 */
export type ToolCallStatus = ToolCallTransientStatus | ToolCallTerminalStatus;

type ToolCallBase = {
  toolName: string;
  requestId: string;
  startedAt: string;
  endedAt?: string;
  input: Record<string, unknown>;
};

export type ToolCallResultSuccess = {
  status: "success";
  result: Record<string, unknown>;
};

export type ToolCallResultError = {
  status: "error";
  result: { isError: true; message: string };
};

export type ToolCallResultAbort = {
  status: "abort";
  result: { isError: true; isAborted: true; message: string };
};

export type ToolCallResultPermissionRequired = {
  status: "permission_required";
  result?: undefined;
  uiHint: PermissionUiHint;
};

export type ToolCallResultPermissionDenied = {
  status: "permission_denied";
  result?: undefined;
  rejectionReason?: "user_rejected" | "timeout";
};

export type ToolCallResultPending = {
  status: "pending";
  result?: undefined;
};

export type ToolCallResultRunning = {
  status: "executing";
  result?: undefined;
};

export type ToolCallPending = ToolCallBase & ToolCallResultPending;
export type ToolCallRunning = ToolCallBase & ToolCallResultRunning;
export type ToolCallPermissionRequired = ToolCallBase &
  ToolCallResultPermissionRequired;
export type ToolCallPermissionDenied = ToolCallBase &
  ToolCallResultPermissionDenied;
export type ToolCallSuccess = ToolCallBase & ToolCallResultSuccess;
export type ToolCallError = ToolCallBase & ToolCallResultError;
export type ToolCallAbort = ToolCallBase & ToolCallResultAbort;

export type ToolCall =
  | ToolCallPending
  | ToolCallRunning
  | ToolCallPermissionRequired
  | ToolCallPermissionDenied
  | ToolCallSuccess
  | ToolCallError
  | ToolCallAbort;

/**
 * Tool call with non-terminal status for onToolUpdate callback.
 */
export type ToolCallNonTerminal =
  | ToolCallPending
  | ToolCallRunning
  | ToolCallPermissionRequired;

/**
 * Tool call with terminal status for onToolComplete callback.
 */
export type ToolCallTerminal =
  | ToolCallSuccess
  | ToolCallError
  | ToolCallAbort
  | ToolCallPermissionDenied;

/**
 * Check if a tool call status is a terminal state (final, immutable).
 *
 * Terminal states indicate the tool has completed execution and will not change again.
 * These are ideal for static rendering in UI components.
 *
 * @param status - The tool call status to check
 * @returns true if the status is a terminal state
 */
export function isTerminalToolState(status: ToolCallStatus): boolean {
  const terminalStates: ToolCallTerminalStatus[] = [
    "success",
    "error",
    "abort",
    "permission_denied",
  ];
  return terminalStates.includes(status as ToolCallTerminalStatus);
}

/**
 * Check if a tool call status is a transient state (can still change).
 *
 * Transient states indicate the tool is still in progress and may transition
 * to other states. These require dynamic rendering in UI components.
 *
 * @param status - The tool call status to check
 * @returns true if the status is a transient state
 */
export function isTransientToolState(status: ToolCallStatus): boolean {
  const transientStates: ToolCallTransientStatus[] = [
    "pending",
    "executing",
    "permission_required",
  ];
  return transientStates.includes(status as ToolCallTransientStatus);
}

/**
 * Check if a tool call (object) is in a terminal state.
 *
 * Convenience function that works with ToolCall objects directly.
 *
 * @param toolCall - The tool call to check
 * @returns true if the tool call is in a terminal state
 */
export function isToolCallTerminal(toolCall: ToolCall): boolean {
  return isTerminalToolState(toolCall.status);
}

/**
 * Check if a tool call (object) is in a transient state.
 *
 * Convenience function that works with ToolCall objects directly.
 *
 * @param toolCall - The tool call to check
 * @returns true if the tool call is in a transient state
 */
export function isToolCallTransient(toolCall: ToolCall): boolean {
  return isTransientToolState(toolCall.status);
}

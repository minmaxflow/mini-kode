/**
 * Agent Executor Types
 *
 * Defines the interface for the core agent execution engine.
 * This allows both interactive (Ink UI) and non-interactive modes to use the same logic.
 */

import type { ApprovalMode } from "../config";
import type { PermissionUiHint, ApprovalDecision } from "../permissions/types";
import type { TokenUsage } from "../llm/client";
import type { CommandCall } from "../ui/commands/command.types";
import type {
  ToolCallRunning,
  ToolCallPending,
  ToolCallPermissionRequired,
  ToolCallSuccess,
  ToolCallError,
  ToolCallAbort,
  ToolCallPermissionDenied,
  ToolCallNonTerminal,
  ToolCallTerminal,
} from "../tools/runner.types";
import type { LLMMessage, Session } from "../sessions/types";

/**
 * Execution context for agent run.
 */
export interface ExecutionContext {
  /** Current working directory */
  cwd: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /**
   * Get the current approval mode.
   *
   * IMPORTANT: This is a function rather than a static value to ensure
   * real-time synchronization between UI state changes and execution logic.
   * When users change approval mode during execution (e.g., via Shift+Tab),
   * this function returns the latest value, preventing stale state issues.
   */
  getApprovalMode: () => ApprovalMode;
  /** Existing session record for conversation history */
  session: Session;
}

/**
 * Callbacks for handling agent execution events.
 * All callbacks are optional.
 */
export interface ExecutionCallbacks {
  /**
   * Called when LLM message updates during streaming or completion.
   * The message status field indicates whether it's streaming, complete, or error.
   */
  onLLMMessageUpdate?: (message: LLMMessage) => void;

  /**
   * Called when a tool starts executing.
   * The tool call will always have status: "running".
   * @param toolCall The tool call with running status
   */
  onToolStart?: (toolCall: ToolCallRunning) => void;

  /**
   * Called when a tool state updates (non-terminal states only).
   * Non-terminal states: pending, executing, permission_required.
   * Use this for intermediate state changes like pending → executing.
   * @param toolCall The tool call with non-terminal status
   */
  onToolUpdate?: (toolCall: ToolCallNonTerminal) => void;

  /**
   * Called when a tool completes execution (terminal states only).
   * Terminal states: success, error, abort, permission_denied.
   * @param toolCall The tool execution result with terminal status
   */
  onToolComplete?: (toolCall: ToolCallTerminal) => void;

  /**
   * Called when a tool requires permission approval.
   *
   * For interactive mode: Display UI prompt and wait for user decision.
   * For non-interactive mode: Immediately return rejection.
   *
   * @param hint Permission information
   * @param requestId The unique request ID
   * @returns Promise resolving to user's decision
   */
  onPermissionRequired?: (
    hint: PermissionUiHint,
    requestId: string,
  ) => Promise<ApprovalDecision>;

  /**
   * Called when LLM generation state changes.
   * @param isGenerating True when starting, false when complete/error/abort
   */
  onGeneratingChange?: (isGenerating: boolean) => void;

  /**
   * Called when execution encounters an error.
   * @param error The error object
   */
  onError?: (error: Error) => void;

  /**
   * Called when execution completes successfully.
   * @param response The final LLM response text
   */
  onComplete?: (response: string) => void;

  /**
   * Called when token usage updates
   */
  onTokenUsageUpdate?: (tokenUsage: TokenUsage) => void;

  /**
   * Called to add a command call to UI state
   */
  onAddCommandCall?: (commandCall: CommandCall) => void;

  /**
   * Called to complete a command call in UI state
   */
  onCompleteCommandCall?: (commandCall: CommandCall) => void;
}

/**
 * Result of agent execution.
 */
export interface ExecutionResult {
  /** Whether execution completed successfully */
  success: boolean;
  /** Final response text (if successful) */
  response?: string;
  /** Error information (if failed) */
  error?: {
    /** Error type for determining exit code */
    type:
      | "permission_denied" // User rejected permission
      | "aborted" // APIUserAbortError (user cancelled via Ctrl+C)
      | "llm_error" // OpenAIError (API errors: rate limit, auth, network, etc.)
      | "internal_error"; // Internal program error (validation, logic errors, etc.)
    /** Human-readable error message */
    message: string;
    /** Original error object */
    cause?: unknown;
  };
}

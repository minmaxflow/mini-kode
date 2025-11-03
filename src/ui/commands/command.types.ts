import type { LlmClient } from "../../llm/client";
import type { UIFeedMessage } from "../types";
import type { AppActions } from "../hooks/useAppState";
import type { MCPServerState } from "../../mcp/client";

/**
 * All possible command call statuses
 */
export type CommandCallStatus = "executing" | "success" | "error";

/**
 * All available command names
 */
export type CommandName = "/clear" | "/compact" | "/init" | "/mcp";

/**
 * Command result types for each command
 */
export type ClearResult = void;

export type CompactResult = string | undefined;

export type InitResult = void;

export type MCPResult = MCPServerState[];

/**
 * Generic type for command results based on command name
 */
export type CommandConcreteResult<T extends CommandName> = T extends "/clear"
  ? ClearResult
  : T extends "/compact"
    ? CompactResult
    : T extends "/init"
      ? InitResult
      : T extends "/mcp"
        ? MCPResult
        : never;

/**
 * Command call interface - represents a command execution
 */
export interface CommandCall<CName extends CommandName = CommandName> {
  kind: "cmd";
  commandName: CName;
  callId: string;
  status: CommandCallStatus;
  startedAt: string;
  endedAt?: string;
  result?: CommandConcreteResult<CName>;
  error?: string;
  /**
   * Whether this command was auto-triggered by the system (e.g., auto-compaction)
   * instead of being manually executed by the user
   */
  autoTriggered?: boolean;
}

/**
 * Command handler interface
 */
export interface CommandHandler<Output> {
  name: CommandName;
  description: string;
  execute: (
    messages: UIFeedMessage[],
    llmClient: LlmClient,
    actions: AppActions,
    onExecutePrompt: (prompt: string) => Promise<void>,
  ) => Promise<Output>;
}

export function isTerminalCommandState(status: CommandCallStatus): boolean {
  return status === "success" || status === "error";
}

export function isTransientCommandState(status: CommandCallStatus): boolean {
  return status === "executing";
}

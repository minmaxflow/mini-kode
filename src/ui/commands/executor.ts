/**
 * ========================================================================
 * Command Executor
 * ========================================================================
 *
 * Core command execution engine that handles command execution with callbacks.
 * Inspired by the agent/executor.ts architecture but simplified for commands.
 *
 * Architecture:
 * - Pure business logic, no UI dependencies
 * - Uses callbacks for event handling
 * - No permission system needed (commands are simple)
 * - Handles command execution lifecycle
 */

import type { CommandName, CommandCall } from "./command.types";
import type { UIFeedMessage } from "../types";
import type { LlmClient } from "../../llm/client";
import type { AppActions } from "../hooks/useAppState";
import { COMMANDS_BY_NAME } from ".";

/**
 *
 * @param commandName Name of the command to execute
 * @param messages Current messages in the conversation
 * @param llmClient LLM client instance
 * @param actions App actions for state management
 * @param onExecutePrompt Callback to execute a prompt through the agent
 * @returns Execution result with success/failure status
 */
export async function executeCommand(
  commandName: CommandName,
  messages: UIFeedMessage[],
  llmClient: LlmClient,
  actions: AppActions,
  onExecutePrompt: (prompt: string) => Promise<void>,
): Promise<CommandCall> {
  // Find command handler
  const command = COMMANDS_BY_NAME[commandName];
  if (!command) {
    throw new Error(`Unknown command: ${commandName}`);
  }

  // Execute the command
  // Commands are now responsible for managing their own state through actions
  const commandResult = await command.execute(
    messages,
    llmClient,
    actions,
    onExecutePrompt,
  );

  // Create a default completed call for backward compatibility
  // Commands that want to control their own state can call actions.addCommandCall() directly
  const startedAt = new Date().toISOString();
  const callId = `${commandName}_${Date.now()}`;
  const completedCall: CommandCall = {
    kind: "cmd",
    commandName,
    callId,
    status: "success",
    startedAt,
    endedAt: new Date().toISOString(),
    result: commandResult,
  };

  return completedCall;
}

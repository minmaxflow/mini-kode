import { clearTerminal } from "../utils/terminal";
import { ClearResult, CommandHandler } from "./command.types";

export const clearCommand: CommandHandler<ClearResult> = {
  name: "/clear",
  description: "Clear conversation history",
  execute: async (messages, llmClient, actions) => {
    // Create command call for UI
    const startedAt = new Date().toISOString();
    const callId = `/clear_${Date.now()}`;
    const commandCall = {
      kind: "cmd" as const,
      commandName: "/clear" as const,
      callId,
      status: "executing" as const,
      startedAt,
    };

    // Notify that command is starting
    actions.addCommandCall(commandCall);

    try {
      await clearTerminal();
      // Clear the session using actions
      actions.clearSession();

      // Mark command as complete
      const completedCall = {
        ...commandCall,
        status: "success" as const,
        endedAt: new Date().toISOString(),
      };
      actions.completeCommandCall(completedCall);
    } catch (error) {
      // Handle error
      const errorCall = {
        ...commandCall,
        status: "error" as const,
        endedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "unknown error",
      };
      actions.completeCommandCall(errorCall);
    }
  },
};

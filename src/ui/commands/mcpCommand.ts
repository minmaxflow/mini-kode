import { mcpService } from "../../mcp";
import type { MCPServerState } from "../../mcp/client";
import { CommandHandler } from "./command.types";

// Define the result type for /mcp command
export type MCPResult = MCPServerState[];

export const mcpCommand: CommandHandler<MCPResult> = {
  name: "/mcp",
  description: "Show MCP server status and available tools",
  execute: async (messages, llmClient, actions, onExecutePrompt) => {
    // Create command call for UI
    const startedAt = new Date().toISOString();
    const callId = `/mcp_${Date.now()}`;
    const commandCall = {
      kind: "cmd" as const,
      commandName: "/mcp" as const,
      callId,
      status: "executing" as const,
      startedAt,
    };

    // Notify that command is starting
    actions.addCommandCall(commandCall);

    // Get MCP server states - this is the result
    const serverStates = mcpService.getServerStates();

    // Mark command as complete with serverStates as result
    const completedCall = {
      ...commandCall,
      status: "success" as const,
      endedAt: new Date().toISOString(),
      result: serverStates,
    };
    actions.completeCommandCall(completedCall);

    // Return the result
    return serverStates;
  },
};

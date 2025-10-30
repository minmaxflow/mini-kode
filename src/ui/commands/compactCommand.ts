import { CommandHandler, type CompactResult } from "./command.types";
import { streamChatCompletion } from "../../llm/client";
import type { LLMMessage } from "../../sessions/types";
import { APIUserAbortError } from "openai";
import { buildSummaryPrompt } from "../../utils/summary";

export const compactCommand: CommandHandler<CompactResult> = {
  name: "/compact",
  description: "Clear conversation history but keep a summary in context",
  execute: async (messages, llmClient, actions, onExecutePrompt) => {
    // Create command call for UI
    const startedAt = new Date().toISOString();
    const callId = `/compact_${Date.now()}`;
    const commandCall = {
      kind: "cmd" as const,
      commandName: "/compact" as const,
      callId,
      status: "executing" as const,
      startedAt,
    };

    // Notify that command is starting
    actions.addCommandCall(commandCall);

    try {
      // Filter to get only LLM messages for processing
      const llmMessages = messages.filter(
        (m): m is LLMMessage => m.kind === "api",
      );

      if (llmMessages.length === 0) {
        throw new Error("No messages to compact");
      }

      // Build summary prompt using shared utility
      const summaryPrompt = buildSummaryPrompt(llmMessages);

      let summaryContent = "";

      // Create abort controller for the compact operation
      const abortController = actions.createAbortController();

      const stream = streamChatCompletion(
        llmClient,
        [
          {
            role: "user" as const,
            content: summaryPrompt,
          },
        ],
        {
          signal: abortController.signal,
        },
      );

      for await (const response of stream) {
        const content =
          typeof response.completeMessage.content === "string"
            ? response.completeMessage.content
            : "";
        summaryContent = content;

        if (response.isComplete) {
          break;
        }
      }

      // Mark command as complete
      const completedCall = {
        ...commandCall,
        status: "success" as const,
        endedAt: new Date().toISOString(),
        result: summaryContent as CompactResult,
      };
      actions.completeCommandCall(completedCall);

      return summaryContent;
    } catch (error) {
      // Handle error
      const errorCall = {
        ...commandCall,
        status: "error" as const,
        endedAt: new Date().toISOString(),
        error:
          error instanceof APIUserAbortError
            ? "compaction canceled"
            : error instanceof Error
              ? error.message
              : "unknown error",
      };
      actions.completeCommandCall(errorCall);
    }
  },
};

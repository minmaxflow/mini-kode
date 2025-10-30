import { z } from "zod";
import { Tool, ArchitectResult } from "./types";
import { createClient, streamChatCompletion } from "../llm/client";
import type { ChatCompletionMessageParam } from "openai/resources";
import { ConfigManager } from "../config";

const InputSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "The technical requirement or feature that needs architectural planning. Be specific about what needs to be built.",
    ),
  context: z
    .string()
    .optional()
    .describe(
      "Additional context about the project, existing codebase, technologies being used, constraints, or specific requirements that should be considered in the architectural plan.",
    ),
});

export type ArchitectInput = z.infer<typeof InputSchema>;

export const ARCHITECT_TOOL_PROMPT: string = `
You are an expert software architect. Your role is to analyze technical requirements and produce clear, actionable implementation plans.
These plans will then be carried out by a junior software engineer so you need to be specific and detailed. However do not actually write the code, just explain the plan.

Follow these steps for each request:
1. Carefully analyze requirements to identify core functionality and constraints
2. Define clear technical approach with specific technologies and patterns
3. Break down implementation into concrete, actionable steps at the appropriate level of abstraction

Keep responses focused, specific and actionable.

IMPORTANT: Do not ask the user if you should implement the changes at the end. Just provide the plan as described above.
IMPORTANT: Do not attempt to write the code or use any string modification tools. Just provide the plan.
`.trim();

export const ArchitectTool: Tool<ArchitectInput, ArchitectResult> = {
  name: "architect",
  description: ARCHITECT_TOOL_PROMPT,
  readonly: true,
  inputSchema: InputSchema,
  async execute(input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    if (!input.prompt.trim()) return { isError: true, message: "Empty prompt" };

    const config = ConfigManager.load();

    try {
      const client = createClient({
        model: config.llm.planModel,
        cwd: context.cwd,
      });

      const systemPrompt = ARCHITECT_TOOL_PROMPT;
      let userPrompt = input.prompt;
      if (input.context) {
        userPrompt = `${input.prompt}\n\nContext: ${input.context}`;
      }

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const stream = streamChatCompletion(client, messages, {
        signal: context.signal,
      });

      let fullResponse = "";

      for await (const response of stream) {
        // Use the complete message content
        fullResponse =
          typeof response.completeMessage.content === "string"
            ? response.completeMessage.content || ""
            : "";

        // Exit early if we have content and the stream is complete
        if (response.isComplete && fullResponse) {
          break;
        }
      }

      return { type: "architect", plan: fullResponse };
    } catch (error) {
      return {
        isError: true,
        message: `Failed to generate architecture plan: ${String(error)}`,
      };
    }
  },
};

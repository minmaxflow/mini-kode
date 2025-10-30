import OpenAI, { APIUserAbortError } from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources";
import type { CompletionUsage } from "openai/resources/completions";

import type { OpenAITool } from "../tools/openai";
import { ConfigManager } from "../config";
import type { ChatFinishReason } from "./types";

export interface LlmClient {
  sdk: OpenAI;
  model: string;
}

// Re-export OpenAI's CompletionUsage type for consistency
export type TokenUsage = CompletionUsage;

export type ParsedToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export interface StreamingResponse {
  // Always available complete message (accumulated content and tool calls)
  completeMessage: ChatCompletionMessageParam;

  // Parsed tool calls (if any) - for specialized UI that needs incremental tool call updates
  parsedToolCalls?: ParsedToolCall[];

  // Whether the stream is finished
  isComplete: boolean;

  // Finish reason (available when isComplete is true)
  finishReason?: ChatFinishReason;

  // Token usage data (available when isComplete is true)
  tokenUsage?: TokenUsage;
}

export function createClient(options?: {
  model?: string;
  cwd: string;
}): LlmClient {
  // Load configuration
  const config = ConfigManager.load();

  const baseURL = config.llm.baseURL;
  const model = options?.model ?? config.llm.model;
  const apiKey = config.llm.apiKey;

  const clientOptions = { apiKey, baseURL };
  const sdk = new OpenAI(clientOptions);
  return { sdk, model };
}

/**
 * Enhanced streaming that provides complete messages during the streaming process
 *
 * This function solves the problem of having to manually reconstruct messages
 * from streaming chunks. It provides:
 * - Always-available complete messages for UI rendering and storage
 * - Cache-friendly message preservation
 * - Proper tool calls accumulation
 * - Simplified interface with single source of truth
 *
 * React UI can simply use response.completeMessage.content for rendering,
 * which will always contain the accumulated content up to that point.
 *
 * For tool calls, callers should wait until isComplete === true before
 * processing, as tool calls are incrementally built during streaming.
 *
 * @param client LLM client
 * @param messages Message history
 * @param options Streaming options
 * @returns Generator yielding streaming responses with complete message data
 */
export async function* streamChatCompletion(
  client: LlmClient,
  messages: ChatCompletionMessageParam[],
  options?: {
    signal?: AbortSignal;
    tools?: OpenAITool[];
  },
): AsyncGenerator<StreamingResponse, void, unknown> {
  const { signal, tools } = options ?? {};

  const requestParams: ChatCompletionCreateParams = {
    model: client.model,
    messages,
    stream: true,
  };

  if (tools && tools.length > 0) {
    requestParams.tools = tools;
  }

  const streamPromise = client.sdk.chat.completions.create(requestParams, {
    signal,
  });

  const stream = await streamPromise;

  // Accumulate message content and tool calls
  let accumulatedContent = "";
  const accumulatedToolCalls = new Map<number, ChatCompletionMessageToolCall>();
  let finishReason: ChatFinishReason | null = null;
  let tokenUsage: TokenUsage | null = null;

  for await (const chunk of stream) {
    // Note: We only process the first choice as we only care about the first choice.
    const delta = chunk.choices?.[0]?.delta;
    const finish = chunk.choices?.[0]?.finish_reason;

    if (finish) {
      finishReason = finish;
    }

    // Capture token usage from the chunk (usually only in the last chunk)
    if (chunk.usage) {
      tokenUsage = {
        prompt_tokens: chunk.usage.prompt_tokens || 0,
        completion_tokens: chunk.usage.completion_tokens || 0,
        total_tokens: chunk.usage.total_tokens || 0,
      };
    }

    // Handle content delta
    const content = delta?.content;
    if (content) {
      accumulatedContent += content;
    }

    // Handle tool calls delta
    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index;

        if (!accumulatedToolCalls.has(index)) {
          // Create a proper function tool call with required fields
          const newToolCall: ChatCompletionMessageToolCall = {
            id: toolCall.id || "",
            type: "function",
            function: {
              name: toolCall.function?.name || "",
              arguments: "",
            },
          };
          accumulatedToolCalls.set(index, newToolCall);
        }

        const accumulated = accumulatedToolCalls.get(index);
        if (accumulated && accumulated.type === "function") {
          if (toolCall.id) {
            accumulated.id = toolCall.id;
          }
          if (toolCall.function?.name) {
            accumulated.function.name = toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            accumulated.function.arguments += toolCall.function.arguments;
          }
        }
      }
    }

    // Always build a complete message (even during streaming)
    // the content is always string, but we can not force this at type level
    let completeMessage: ChatCompletionAssistantMessageParam;
    let parsedToolCalls: ParsedToolCall[] = [];

    if (accumulatedToolCalls.size > 0) {
      // Tool calls response (even if still streaming)
      const sortedToolCalls = Array.from(accumulatedToolCalls.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, call]) => call);

      completeMessage = {
        role: "assistant",
        content: accumulatedContent || null,
        tool_calls: sortedToolCalls,
      };

      // Create parsed tool calls for consumers (only when streaming is complete)
      if (finishReason !== null) {
        parsedToolCalls = sortedToolCalls.map((call) => {
          if ("function" in call) {
            return {
              id: call.id,
              name: call.function.name,
              arguments: JSON.parse(call.function.arguments),
            };
          }
          // Handle custom tool calls (if any)
          throw new Error("Unexpected tool call type");
        });
      }
    } else {
      // Text-only response
      // Handle empty responses from some LLM providers (e.g., DeepSeek)
      // Some providers may return null/empty content when no text is generated,
      // which violates OpenAI API requirements that assistant messages must have
      // either content or tool_calls. We provide a default response to ensure
      // message validation passes.
      let content = accumulatedContent;
      if (!content) {
        content = "(Empty response)"; // Default response for empty LLM output
      }

      completeMessage = {
        role: "assistant",
        content: content,
      };
    }

    // Always yield when there's content or the stream is complete
    if (content || finishReason !== null || parsedToolCalls.length > 0) {
      yield {
        completeMessage,
        parsedToolCalls:
          parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
        isComplete: finishReason !== null,
        finishReason: finishReason || undefined,
        tokenUsage: tokenUsage || undefined,
      };
    }
  }

  // The SDK might detect the abort signal and stop streaming data, but won't always
  // throw APIUserAbortError. The UI specifically checks for APIUserAbortError to
  // display the "Interrupted by User" message to users.
  // We check after yielding to ensure partial content is delivered to the UI first.
  if (!finishReason && signal?.aborted) {
    throw new APIUserAbortError();
  }
}

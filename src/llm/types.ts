import type { ChatCompletionChunk } from "openai/resources/chat/completions";

export type ChatFinishReason =
  ChatCompletionChunk["choices"][number]["finish_reason"];

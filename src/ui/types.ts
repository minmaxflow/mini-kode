import type { LLMMessage } from "../sessions/types";
import { CommandCall } from "./commands";

/**
 * UI feed message union: combines LLM messages with command messages.
 * This is ONLY used by the UI layer. The Session (agent layer) only stores LLMMessage[].
 */
export type UIFeedMessage = LLMMessage | CommandCall;

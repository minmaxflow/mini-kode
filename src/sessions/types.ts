import type { ChatCompletionMessageParam } from "openai/resources";
import { APIUserAbortError, type OpenAIError } from "openai";

import type { ToolCall } from "../tools/runner.types";

/**
 * ========================================================================
 * OpenAI Chat Completions API - Message Ordering Requirements
 * ========================================================================
 *
 * The OpenAI API enforces STRICT ordering rules for messages. Violating these
 * rules results in 400 errors like:
 * "Messages with role 'tool' must be a response to a preceding message with 'tool_calls'"
 *
 * 🔴 CRITICAL RULES:
 *
 * 1. TOOL MESSAGE MUST FOLLOW ASSISTANT WITH TOOL_CALLS
 *    ✅ VALID:
 *    [
 *      { role: "user", content: "..." },
 *      { role: "assistant", tool_calls: [{ id: "call_1", ... }] },  // Has tool_calls
 *      { role: "tool", tool_call_id: "call_1", content: "..." },    // Responds to call_1
 *      { role: "assistant", content: "..." }                         // Continues conversation
 *    ]
 *
 *    ❌ INVALID:
 *    [
 *      { role: "user", content: "..." },
 *      { role: "tool", tool_call_id: "call_1", content: "..." },    // ERROR: No preceding tool_calls
 *    ]
 *
 * 2. EACH TOOL_CALL MUST HAVE EXACTLY ONE TOOL MESSAGE
 *    ✅ VALID: One tool message per tool_call_id
 *    ❌ INVALID: Duplicate tool messages with same tool_call_id
 *    ❌ INVALID: Missing tool message for a tool_call_id
 *
 * 3. TOOL_CALL_ID MUST MATCH
 *    - Each tool message's tool_call_id must match an id in the preceding assistant's tool_calls
 *
 * 4. TOOL MESSAGE ORDERING (mini-kode specific requirement)
 *    - Although OpenAI API allows tool messages in ANY ORDER (concurrent execution),
 *      mini-kode enforces SEQUENTIAL ORDER for consistency and debuggability
 *    - Tool messages must appear in the SAME ORDER as tool_calls array
 *    - This matches our execution strategy:
 *      • Readonly tools: concurrent execution, but results returned in order
 *      • Non-readonly tools: sequential execution to prevent side effects
 *    ✅ VALID:
 *    [
 *      { role: "assistant", tool_calls: [{ id: "call_1" }, { id: "call_2" }] },
 *      { role: "tool", tool_call_id: "call_1", content: "..." },  // First in order
 *      { role: "tool", tool_call_id: "call_2", content: "..." },  // Second in order
 *    ]
 *    ❌ INVALID:
 *    [
 *      { role: "assistant", tool_calls: [{ id: "call_1" }, { id: "call_2" }] },
 *      { role: "tool", tool_call_id: "call_2", content: "..." },  // Out of order!
 *      { role: "tool", tool_call_id: "call_1", content: "..." },
 *    ]
 *
 * 5. ASSISTANT MESSAGE WITH TOOL_CALLS MUST BE FOLLOWED BY TOOL MESSAGES
 *    ❌ INVALID:
 *    [
 *      { role: "assistant", tool_calls: [{ id: "call_1", ... }] },
 *      { role: "user", content: "..." }  // ERROR: Missing tool message for call_1
 *    ]
 *
 * 6. AFTER ALL TOOL MESSAGES, MUST CONTINUE WITH ASSISTANT OR USER
 *    ✅ VALID: tool messages → assistant (LLM processes results)
 *    ✅ VALID: tool messages → user (new user input)
 *    ❌ INVALID: tool messages → another tool message without assistant in between
 *
 * 7. CONSECUTIVE USER MESSAGES ARE ALLOWED
 *    ✅ VALID: user → user (when LLM response is canceled)
 *    Example scenario:
 *    [
 *      { role: "user", content: "First question" },
 *      { role: "assistant", content: "First answer..." },
 *      { role: "user", content: "Follow-up question" },
 *      // User cancels LLM response before assistant generates anything
 *      { role: "user", content: "New question after cancel" }  // This is valid
 *    ]
 *    Note: OpenAI API allows consecutive user messages, they are treated as
 *    separate user inputs in the conversation history.
 *
 * 📋 TYPICAL MESSAGE FLOW:
 *
 * Round 1:
 *   1. user: "Read file.txt"
 *   2. assistant: null content, tool_calls: [{ id: "call_1", function: "fileRead", ... }]
 *   3. tool: tool_call_id: "call_1", content: "{ file content }"
 *   4. assistant: "The file contains..."
 *
 * Round 2 (multi-tool):
 *   5. user: "Compare file1.txt and file2.txt"
 *   6. assistant: null content, tool_calls: [
 *        { id: "call_2", function: "fileRead", arguments: "file1.txt" },
 *        { id: "call_3", function: "fileRead", arguments: "file2.txt" }
 *      ]
 *   7. tool: tool_call_id: "call_2", content: "{ file1 content }"  // First in tool_calls order
 *   8. tool: tool_call_id: "call_3", content: "{ file2 content }"  // Second in tool_calls order
 *   9. assistant: "After comparing both files..."
 *   Note: Even with concurrent execution, tool messages maintain tool_calls order
 *
 * ⚠️ COMMON PITFALLS IN ABORT/ERROR SCENARIOS:
 *
 * Problem 1: DUPLICATE TOOL MESSAGES
 * - Tool execution completes and adds tool message
 * - User aborts immediately after
 * - UI abort handler ALSO adds tool message for same tool_call_id
 * - Result: 2 tool messages for same tool_call_id → 400 error on next request
 *
 * Problem 2: INVALID ASSISTANT MESSAGES
 * - LLM streaming gets aborted IMMEDIATELY (before generating ANY content)
 * - Executor saves assistant message: content is null/empty, no tool_calls
 * - This violates OpenAI requirement: assistant must have EITHER content OR tool_calls
 * - Next request sends this invalid message → "content or tool_calls must be set" → 400 error
 * - Note: If abort happens AFTER some content generated (e.g. "Let me..."),
 *   that's valid because it has content. Problem only occurs with zero content.
 *
 * Problem 3: INCOMPLETE TOOL MESSAGE SEQUENCE
 * - Assistant has tool_calls: ["call_1", "call_2"]
 * - Only tool message for "call_1" added (call_2 aborted)
 * - Next user message added
 * - Result: Missing tool message for "call_2" → 400 error
 *
 * 🔧 ARCHITECTURE IMPLICATIONS:
 *
 * 1. SINGLE SOURCE OF TRUTH
 *    - executor.ts maintains conversationHistory (the canonical message list)
 *    - UI state (useAppState) mirrors this but with additional UI-only fields
 *    - On abort, BOTH must update consistently
 *
 * 2. ABORT HANDLING REQUIREMENTS
 *    - If tool execution started → add tool message with abort status
 *    - If tool execution finished → keep existing tool message (don't duplicate)
 *    - If LLM streaming aborted → only save assistant message if it has valid content or tool_calls
 *      (skip messages with empty/null content and no tool_calls)
 *
 * 3. MESSAGE VALIDATION
 *    - Before sending to OpenAI, validate message sequence
 *    - Check: every tool message has preceding assistant with tool_calls
 *    - Check: no duplicate tool_call_ids
 *    - Check: all tool_calls have corresponding tool messages
 *
 * 4. SESSION PERSISTENCE (Optional - defensive programming)
 *    - When loading persisted sessions, optionally validate message integrity
 *    - If core logic is correct, messages should always be valid
 *    - Validation/cleanup is only needed for debugging or recovering from bugs
 *
 * ========================================================================
 */

/**
 * Lifecycle status for API (LLM) messages shown in the feed.
 *
 * - streaming: Message is being generated by LLM
 * - complete: Message successfully completed
 * - error: Message failed (check error field for details, including abort via APIUserAbortError)
 */
export type LLMMessageStatus = "streaming" | "complete" | "error";

/**
 * Wrapper around OpenAI ChatCompletionMessageParam used by the UI feed.
 * IMPORTANT: Do NOT send this object directly to the API. Always project
 * with toOpenAIMessages() to strip UI-only fields.
 */
export interface LLMMessage {
  kind: "api";
  status: LLMMessageStatus;
  message: ChatCompletionMessageParam;
  error?: OpenAIError;
}

/**
 * Utility: project LLM messages to pure OpenAI messages for API calls.
 * Strips UI-only fields (status, error) to get raw ChatCompletionMessageParam[].
 */
export function toOpenAIMessages(
  messages: LLMMessage[],
): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    // Add "[Interrupted by User]" marker to aborted assistant messages
    // Note: This is used for API calls to maintain conversation history
    // The UI has separate handling for interrupted messages (see TextMessage.tsx)
    // This ensures the interruption is preserved in the conversation context
    if (
      m.status === "error" &&
      m.error instanceof APIUserAbortError &&
      m.message.role === "assistant"
    ) {
      return {
        ...m.message,
        content: `${m.message.content ? m.message.content : ""}\n\n[Interrupted by User]`,
      };
    }
    return m.message;
  });
}

/**
 * Utility: wrap a ChatCompletionMessageParam into LLMMessage with complete status.
 * Used when adding messages to session that are already complete (e.g., from executor).
 */
export function wrapAsLLMMessage(
  message: ChatCompletionMessageParam,
): LLMMessage {
  return {
    kind: "api",
    status: "complete",
    message,
  };
}

export interface Session {
  sessionId: string;
  messages: LLMMessage[];
  toolCalls: ToolCall[];
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSession(init?: {
  messages?: LLMMessage[];
  toolCalls?: ToolCall[];
}): Session {
  return {
    sessionId: randomId("session"),
    messages: init?.messages ?? [],
    toolCalls: init?.toolCalls ?? [],
  };
}

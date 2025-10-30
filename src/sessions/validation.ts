/**
 * ========================================================================
 * Message Validation - OpenAI API Compliance
 * ========================================================================
 *
 * This module provides validation utilities to ensure message sequences
 * comply with OpenAI Chat Completions API requirements.
 *
 * See detailed API requirements in: src/sessions/types.ts
 *
 * WHEN TO USE:
 *
 * Use these validators as a safety net to catch issues before sending to OpenAI:
 * - Before calling streamChatCompletion with conversationHistory
 * - When resuming sessions from persistence
 * - In development/testing to verify message integrity
 *
 * DESIGN PHILOSOPHY:
 *
 * This is DEFENSIVE programming - the core logic (executor + UI abort handler)
 * should already prevent these issues through proper state management.
 * This validation catches edge cases and provides clear error messages.
 *
 * ========================================================================
 */

import type { ChatCompletionMessageParam } from "openai/resources";

/**
 * Result of message validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate complete message sequence for OpenAI API compliance
 *
 * PROBLEM THIS DETECTS:
 * - Assistant messages with neither content nor tool_calls (invalid per OpenAI API)
 * - Tool message without preceding assistant with tool_calls
 * - Duplicate tool messages with same tool_call_id
 * - Missing tool messages for tool_calls (incomplete responses)
 * - Tool messages out of order (not matching tool_calls array order)
 *
 * WHAT IS ALLOWED:
 * - Consecutive user messages (e.g., when LLM response is canceled)
 * - User messages after tool messages (new user input)
 * - Assistant messages after tool messages (LLM processing results)
 *
 * @param messages Message sequence to validate
 * @returns Validation result with errors if any
 */
export function validateMessageSequence(
  messages: ChatCompletionMessageParam[],
): ValidationResult {
  const errors: string[] = [];
  const seenToolCallIds = new Set<string>();
  let pendingToolCallsArray: Array<{ id: string; index: number }> | null = null;
  let nextExpectedToolCallIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "assistant") {
      // Check 0: Assistant message must have either content or tool_calls
      // This is the fundamental OpenAI API requirement
      const hasContent = msg.content !== null && msg.content !== "";
      const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;

      if (!hasContent && !hasToolCalls) {
        errors.push(
          `Message ${i}: assistant message must have either content or tool_calls, but both are missing (content: ${msg.content}, tool_calls: ${msg.tool_calls?.length || 0})`,
        );
      }

      // Check 4: Before starting new assistant message, verify all previous tool_calls were answered
      if (pendingToolCallsArray && pendingToolCallsArray.length > 0) {
        const missingIds = pendingToolCallsArray.map((tc) => tc.id);
        errors.push(
          `Message ${i}: missing tool messages for tool_call_ids: ${missingIds.join(", ")}`,
        );
      }

      // Track tool_calls from assistant messages with their order
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        pendingToolCallsArray = msg.tool_calls.map((tc, index) => ({
          id: tc.id,
          index,
        }));
        nextExpectedToolCallIndex = 0;
      } else {
        // Assistant message without tool_calls resets tracking
        pendingToolCallsArray = null;
        nextExpectedToolCallIndex = 0;
      }
    } else if (msg.role === "tool") {
      const toolCallId = msg.tool_call_id;

      // Check 3: No duplicate tool messages (check first to avoid confusing error messages)
      if (seenToolCallIds.has(toolCallId)) {
        errors.push(
          `Message ${i}: duplicate tool message for tool_call_id '${toolCallId}'`,
        );
        // Don't process further for duplicates
        continue;
      }
      seenToolCallIds.add(toolCallId);

      // Check 1: Tool message must have preceding assistant with tool_calls
      if (!pendingToolCallsArray) {
        errors.push(
          `Message ${i}: tool message (tool_call_id: ${toolCallId}) has no preceding assistant message with tool_calls`,
        );
      } else {
        // Check 2: Tool_call_id must match one from preceding assistant
        const toolCallEntry = pendingToolCallsArray.find(
          (tc) => tc.id === toolCallId,
        );
        if (!toolCallEntry) {
          errors.push(
            `Message ${i}: tool_call_id '${toolCallId}' not found in preceding assistant's tool_calls`,
          );
        } else {
          // Check ordering: tool message must match expected order
          if (toolCallEntry.index !== nextExpectedToolCallIndex) {
            const expectedId =
              pendingToolCallsArray[nextExpectedToolCallIndex]?.id;
            errors.push(
              `Message ${i}: tool messages out of order. Expected tool_call_id '${expectedId}' (index ${nextExpectedToolCallIndex}), but got '${toolCallId}' (index ${toolCallEntry.index})`,
            );
          }

          // Remove from pending and increment expected index
          pendingToolCallsArray = pendingToolCallsArray.filter(
            (tc) => tc.id !== toolCallId,
          );
          nextExpectedToolCallIndex++;
        }
      }
    } else if (msg.role === "user") {
      // Check 4: Before user message, verify all previous tool_calls were answered
      if (pendingToolCallsArray && pendingToolCallsArray.length > 0) {
        const missingIds = pendingToolCallsArray.map((tc) => tc.id);
        errors.push(
          `Message ${i}: missing tool messages for tool_call_ids: ${missingIds.join(", ")}`,
        );
        pendingToolCallsArray = null;
        nextExpectedToolCallIndex = 0;
      }
    }
  }

  // Check 5: At end of sequence, verify all tool_calls were answered
  if (pendingToolCallsArray && pendingToolCallsArray.length > 0) {
    const missingIds = pendingToolCallsArray.map((tc) => tc.id);
    errors.push(
      `End of sequence: missing tool messages for tool_call_ids: ${missingIds.join(", ")}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

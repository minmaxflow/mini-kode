/**
 * Tests for message validation utilities
 */

import { describe, it, expect } from "vitest";

import type { ChatCompletionMessageParam } from "openai/resources";

import { validateMessageSequence } from "./validation";

describe("Message Validation", () => {
  describe("validateMessageSequence", () => {
    it("should validate correct tool message sequence", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Read file.txt" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "fileRead", arguments: '{"path":"file.txt"}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "file content" },
        { role: "assistant", content: "The file contains..." },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing tool messages at end of sequence", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Test" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
          ],
        },
        // Missing tool message for call_1
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("missing tool messages");
      expect(result.errors[0]).toContain("call_1");
    });

    it("should detect missing tool messages before next assistant message", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Test" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "test1", arguments: "{}" },
            },
            {
              id: "call_2",
              type: "function",
              function: { name: "test2", arguments: "{}" },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "result" },
        // Missing tool message for call_2
        { role: "assistant", content: "Next message" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("missing tool messages");
      expect(result.errors[0]).toContain("call_2");
    });

    it("should detect missing tool messages before user message", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Test" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
          ],
        },
        // Missing tool message for call_1
        { role: "user", content: "Next question" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("missing tool messages");
      expect(result.errors[0]).toContain("call_1");
    });

    it("should detect tool message without preceding assistant", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Read file.txt" },
        { role: "tool", tool_call_id: "call_1", content: "file content" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(
        "has no preceding assistant message with tool_calls",
      );
    });

    it("should detect duplicate tool messages", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Read file.txt" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "fileRead", arguments: '{"path":"file.txt"}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "file content" },
        { role: "tool", tool_call_id: "call_1", content: "duplicate content" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("duplicate tool message");
    });

    it("should detect tool_call_id mismatch", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Read file.txt" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "fileRead", arguments: '{"path":"file.txt"}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_2", content: "file content" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain("not found in preceding assistant");
      expect(result.errors[1]).toContain("missing tool messages");
      expect(result.errors[1]).toContain("call_1");
    });

    it("should validate multiple tool calls in sequence", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Read two files" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file1.txt"}',
              },
            },
            {
              id: "call_2",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file2.txt"}',
              },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "content 1" },
        { role: "tool", tool_call_id: "call_2", content: "content 2" },
        { role: "assistant", content: "Both files read" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject tool messages in different order (enforce sequential order)", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Read three files" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file1.txt"}',
              },
            },
            {
              id: "call_2",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file2.txt"}',
              },
            },
            {
              id: "call_3",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file3.txt"}',
              },
            },
          ],
        },
        // Tools complete in different order (call_2 first, then call_1, then call_3)
        // This should now be INVALID
        { role: "tool", tool_call_id: "call_2", content: "content 2" },
        { role: "tool", tool_call_id: "call_1", content: "content 1" },
        { role: "tool", tool_call_id: "call_3", content: "content 3" },
        { role: "assistant", content: "All files read" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      // First tool message (call_2) is out of order - expected call_1
      expect(result.errors[0]).toContain("out of order");
      expect(result.errors[0]).toContain("call_1");
      expect(result.errors[0]).toContain("call_2");
      // Second tool message (call_1) is also out of order - expected call_1 but it's at wrong position
      expect(result.errors[1]).toContain("out of order");
    });

    it("should validate tool messages in correct order", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Read three files" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file1.txt"}',
              },
            },
            {
              id: "call_2",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file2.txt"}',
              },
            },
            {
              id: "call_3",
              type: "function",
              function: {
                name: "fileRead",
                arguments: '{"path":"file3.txt"}',
              },
            },
          ],
        },
        // Tools complete in correct order matching tool_calls array
        { role: "tool", tool_call_id: "call_1", content: "content 1" },
        { role: "tool", tool_call_id: "call_2", content: "content 2" },
        { role: "tool", tool_call_id: "call_3", content: "content 3" },
        { role: "assistant", content: "All files read" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should handle assistant message without tool_calls between tool sequences", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "First task" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "fileRead", arguments: '{"path":"file.txt"}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "content" },
        { role: "assistant", content: "First task done" },
        { role: "user", content: "Second task" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_2",
              type: "function",
              function: { name: "bash", arguments: '{"command":"ls"}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_2", content: "output" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("validateMessageSequence", () => {
    it("should validate complete message sequence", () => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: "Test" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_1", content: "result" },
        { role: "assistant", content: "Done" },
      ];

      const result = validateMessageSequence(messages);
      expect(result.valid).toBe(true);
    });
  });
});

import { describe, test, expect } from "vitest";

import { formatToolResultMessage } from "./formatters";
import type { ToolCall } from "../tools/runner.types";

describe("formatToolResultMessage", () => {
  test("should format successful tool result", () => {
    const result: ToolCall = {
      toolName: "fileRead",
      requestId: "req_1",
      status: "success",
      startedAt: "2025-01-01T00:00:00Z",
      endedAt: "2025-01-01T00:00:01Z",
      input: { filePath: "/tmp/test.txt" },
      result: {
        type: "fileRead",
        filePath: "/tmp/test.txt",
        content: "Hello, world!",
        offset: 0,
        limit: 100,
        totalLines: 1,
        truncated: false,
      },
    };

    const message = formatToolResultMessage(result);

    expect(message.role).toBe("tool");

    if (message.role === "tool") {
      expect(message.tool_call_id).toBe("req_1");
      expect(message.content).toContain("fileRead");

      // Content should be JSON string
      if (typeof message.content === "string") {
        const parsed = JSON.parse(message.content);
        expect(parsed.type).toBe("fileRead");
        expect(parsed.content).toBe("Hello, world!");
      }
    }
  });

  test("should format error result", () => {
    const result: ToolCall = {
      toolName: "fileRead",
      requestId: "req_1",
      status: "error",
      startedAt: "2025-01-01T00:00:00Z",
      endedAt: "2025-01-01T00:00:01Z",
      input: { filePath: "/tmp/test.txt" },
      result: {
        isError: true,
        message: "File not found",
      },
    };

    const message = formatToolResultMessage(result);

    expect(message.role).toBe("tool");

    if (message.role === "tool") {
      expect(message.content).toContain("Error");
      expect(message.content).toContain("File not found");
    }
  });

  test("should throw error for unexpected status", () => {
    const result: ToolCall = {
      toolName: "bash",
      requestId: "req_1",
      status: "permission_required",
      startedAt: "2025-01-01T00:00:00Z",
      endedAt: "2025-01-01T00:00:01Z",
      input: { command: "ls" },
      uiHint: { kind: "bash", command: "ls" },
    };

    expect(() => formatToolResultMessage(result)).toThrow(
      "Unexpected tool result status: permission_required",
    );
  });

  test("should format abort result", () => {
    const result: ToolCall = {
      toolName: "fileRead",
      requestId: "req_1",
      status: "abort",
      startedAt: "2025-01-01T00:00:00Z",
      endedAt: "2025-01-01T00:00:01Z",
      input: { filePath: "/tmp/test.txt" },
      result: {
        isError: true,
        isAborted: true,
        message: "Tool execution was interrupted by user",
      },
    };

    const message = formatToolResultMessage(result);

    expect(message.role).toBe("tool");

    if (message.role === "tool") {
      expect(message.content).toBe("Tool execution was interrupted by user");
    }
  });

  test("should have correct role and tool_call_id", () => {
    const result: ToolCall = {
      toolName: "fileRead",
      requestId: "req_1",
      status: "success",
      startedAt: "2025-01-01T00:00:00Z",
      input: { filePath: "test.txt" },
      result: {
        type: "fileRead",
        filePath: "test.txt",
        content: "test",
        offset: 0,
        limit: 100,
        totalLines: 1,
        truncated: false,
      },
    };

    const message = formatToolResultMessage(result);

    expect(message.role).toBe("tool");

    if (message.role === "tool") {
      expect(message.tool_call_id).toBe("req_1");
    }
  });
});

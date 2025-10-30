import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import MessageFeed from "./MessageFeed";
import type { LLMMessage } from "../../sessions/types";

// Mock functions for required props
const mockOnApprove = () => {};
const mockOnReject = () => {};

function wrapUser(content: string): LLMMessage {
  return {
    kind: "api",
    status: "complete",
    message: { role: "user", content },
  };
}

function wrapAssistant(content: string): LLMMessage {
  return {
    kind: "api",
    status: "complete",
    message: { role: "assistant", content },
  };
}

function wrapAssistantWithToolCalls(): LLMMessage {
  return {
    kind: "api",
    status: "complete",
    message: {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_1",
          type: "function" as const,
          function: {
            name: "test_tool",
            arguments: "{}",
          },
        },
      ],
    },
  };
}

function wrapTool(content: string, toolCallId: string): LLMMessage {
  return {
    kind: "api",
    status: "complete",
    message: { role: "tool", content, tool_call_id: toolCallId },
  };
}

describe("MessageFeed component", () => {
  describe("Message rendering", () => {
    it("renders messages in order", () => {
      const messages = [
        wrapUser("User message"),
        wrapAssistant("Assistant response"),
      ];

      const { lastFrame } = render(
        <MessageFeed
          messages={messages}
          toolCalls={[]}
          cwd="/test"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          clearNum={0}
        />,
      );

      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain("●");
      expect(output).toContain("User message");
      expect(output).toContain("Assistant response");

      // User message should come before Assistant message
      const userIdx = output!.indexOf("User message");
      const assistantIdx = output!.indexOf("Assistant response");
      expect(userIdx).toBeLessThan(assistantIdx);
    });

    it("renders assistant message with markdown", () => {
      const messages = [wrapAssistant("**Bold text** and _italic text_")];

      const { lastFrame } = render(
        <MessageFeed
          messages={messages}
          toolCalls={[]}
          cwd="/test"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          clearNum={0}
        />,
      );

      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain("Bold text");
      expect(output).toContain("italic text");
    });

    it("renders empty state", () => {
      const { lastFrame } = render(
        <MessageFeed
          messages={[]}
          toolCalls={[]}
          cwd="/test"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          clearNum={0}
        />,
      );

      const output = lastFrame();
      expect(output).toBeDefined();
      // Should be empty when no static header and no messages
      expect(output).toBe("");
    });

    it("renders static header", () => {
      const { lastFrame } = render(
        <MessageFeed
          messages={[]}
          toolCalls={[]}
          cwd="/test"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          staticHeader={<div>Custom Header</div>}
          clearNum={0}
        />,
      );

      const output = lastFrame();
      expect(output).toBeDefined();
      // Should render static header even with no messages
      expect(output).toContain("Custom Header");
    });

    it("filters empty assistant messages in static area", () => {
      const messagesWithEmptyAssistant = [
        wrapUser("Hello"),
        wrapAssistantWithToolCalls(),
        wrapTool("Tool result", "call_1"),
        wrapAssistant("This has content"),
      ];

      // Mock tool call to make tool message display
      const mockToolCalls = [
        {
          requestId: "call_1",
          toolName: "fileRead" as const,
          status: "success" as const,
          input: {},
          startedAt: new Date().toISOString(),
          result: {
            type: "fileRead" as const,
            filePath: "/test/file.txt",
            content: "Tool result",
            offset: 0,
            limit: 100,
            totalLines: 1,
            truncated: false,
          },
        },
      ];

      const { lastFrame } = render(
        <MessageFeed
          messages={messagesWithEmptyAssistant}
          toolCalls={mockToolCalls}
          cwd="/test"
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          clearNum={0}
        />,
      );

      const output = lastFrame();
      expect(output).toBeDefined();
      // Should show user message
      expect(output).toContain("Hello");
      // Should show assistant message with content
      expect(output).toContain("This has content");
      // Should show tool result (displayed as tool name "Read" and file info)
      expect(output).toContain("Read");
      expect(output).toContain("Read 1 lines");
      // Empty assistant message should be filtered out (no empty lines between Hello and "This has content")
    });
  });
});

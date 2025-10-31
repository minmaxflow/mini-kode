import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { PromptInput } from "./PromptInput";
import { AppActions, AppState } from "../hooks/useAppState";

// Mock AppState and AppActions for testing
const mockAppState: AppState = {
  isLLMGenerating: false,
  sessionId: "test-session",
  messages: [],
  toolCalls: [],
  currentApprovalMode: "default" as const,
  tokenUsage: {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  },
  clearNum: 0,
  mcp: {
    initialized: false,
    servers: [],
  },
};

const mockAppActions: AppActions = {
  executePrompt: vi.fn(),
  createAbortController: vi.fn(() => new AbortController()),
  startRequest: vi.fn(),
  updateLLMMessage: vi.fn(),
  abort: vi.fn(),
  setLLMGenerating: vi.fn(),
  setError: vi.fn(),
  addToolCall: vi.fn(),
  updateToolCall: vi.fn(),
  completeToolCall: vi.fn(),
  cycleApprovalMode: vi.fn(),
  addCommandCall: vi.fn(),
  completeCommandCall: vi.fn(),
  clearSession: vi.fn(),
  updateTokenUsage: vi.fn(),
  initializeMCP: vi.fn(),
  updateMCPServer: vi.fn(),
  completeMCPInitialization: vi.fn(),
};

const mockOnExit = vi.fn();
const mockOnExecuteCommand = vi.fn();

describe("PromptInput - Comprehensive Tests", () => {
  describe("Basic Input Functionality", () => {
    it("should render with placeholder initially", () => {
      const { lastFrame } = render(
        <PromptInput
          onSubmit={vi.fn()}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          placeholder="Type your prompt"
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );
      expect(lastFrame()).toContain("Type your prompt");
    });

    it("should handle character input correctly", async () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Type a single character
      stdin.write("h");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Component should handle input and display the character
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain("h");
    });

    it("should handle multiple characters", async () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Type multiple characters
      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Component should handle multiple characters
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain("hello");
    });
  });

  describe("Bulk Paste Handling", () => {
    it("should handle bulk paste without crashing", async () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Simulate bulk paste of a code block
      const code = "function test() { return 'hello'; }";
      stdin.write(code);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Component should handle paste and display the code
      expect(lastFrame()).toContain("function test()");
    });
  });

  describe("@mention Functionality", () => {
    it("should handle @mention input without crashing", async () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Type @mention
      stdin.write("help @src/");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should handle @mention input and display the text
      expect(lastFrame()).toContain("help @src/");
    });

    it("should handle ESC key in mention mode", async () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Type @ to trigger mention mode
      // Note: Must input @ separately to properly trigger mentionMode state
      // Inputting "@src/" in one call doesn't trigger the @ character detection
      stdin.write("@");
      await new Promise((resolve) => setTimeout(resolve, 10));
      stdin.write("src/");
      stdin.write("\u001b"); // ESC key
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should handle ESC and still display the input
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain("@src/");
    });
  });

  describe("Text Navigation and Editing", () => {
    it("should handle cursor navigation without crashing", async () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Type some text then use cursor keys
      stdin.write("hello");
      stdin.write("\u001b[D"); // Left arrow
      stdin.write("\u001b[C"); // Right arrow
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should handle navigation and display the text
      expect(lastFrame()).toContain("hello");
    });

    it("should handle form submission", () => {
      const onSubmit = vi.fn();
      const { stdin } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Type text and submit
      stdin.write("test message");
      stdin.write("\r"); // Enter key

      // Should trigger submission
      expect(onSubmit).toHaveBeenCalledWith("test message");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty input correctly", () => {
      const onSubmit = vi.fn();
      const { lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          placeholder="Enter your command"
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Should show placeholder when empty
      expect(lastFrame()).toContain("Enter your command");
    });

    it("should handle special characters without crashing", async () => {
      const onSubmit = vi.fn();
      const { stdin, lastFrame } = render(
        <PromptInput
          onSubmit={onSubmit}
          onExit={mockOnExit}
          cwd={process.cwd()}
          onCycleApprovalMode={() => {}}
          state={mockAppState}
          actions={mockAppActions}
          onExecuteCommand={mockOnExecuteCommand}
        />,
      );

      // Paste text with special characters
      stdin.write("Hello! @#$%^&*()");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should handle special characters and display them
      expect(lastFrame()).toContain("Hello! @#$%^&*()");
    });
  });
});

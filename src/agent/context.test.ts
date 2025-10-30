import { describe, test, expect, vi } from "vitest";

import { buildSystemMessage } from "./context";

// Mock createClient
vi.mock("../llm/client", () => ({
  createClient: vi.fn(() => ({
    model: "test-model",
    apiKey: "test-key",
    baseURL: "https://test.api",
  })),
}));

// Mock fs
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ""),
  },
}));

describe("agent/context", () => {
  describe("buildSystemMessage", () => {
    test("should build system message with environment details", async () => {
      const systemMessage = await buildSystemMessage("/test/path");

      expect(systemMessage.role).toBe("system");
      expect(systemMessage.content).toContain("interactive CLI tool");
      expect(systemMessage.content).toContain("/test/path");
      expect(systemMessage.content).toContain("test-model");
    });

    test("should include AGENTS.md content if it exists", async () => {
      const fs = await import("fs");
      vi.mocked(fs.default.existsSync).mockReturnValue(true);
      vi.mocked(fs.default.readFileSync).mockReturnValue(
        "# Custom Agent Instructions\nFollow these rules...",
      );

      const systemMessage = await buildSystemMessage("/test/path");

      expect(systemMessage.content).toContain("Custom Agent Instructions");
      expect(systemMessage.content).toContain("Follow these rules...");
    });

    test("should use provided cwd parameter", async () => {
      const systemMessage = await buildSystemMessage("/custom/path");

      expect(systemMessage.content).toContain("/custom/path");
    });

    test("should include git repository status", async () => {
      const systemMessage = await buildSystemMessage("/test/path");

      expect(systemMessage.content).toContain("Is directory a git repo:");
    });

    test("should include platform information", async () => {
      const systemMessage = await buildSystemMessage("/test/path");

      expect(systemMessage.content).toContain("Platform:");
    });

    test("should include current date", async () => {
      const systemMessage = await buildSystemMessage("/test/path");

      expect(systemMessage.content).toContain("Today's date:");
    });

    test("should include model information", async () => {
      const systemMessage = await buildSystemMessage("/test/path");

      expect(systemMessage.content).toContain("Model: test-model");
    });
  });
});

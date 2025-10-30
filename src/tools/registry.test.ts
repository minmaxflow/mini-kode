import { describe, test, expect } from "vitest";
import { FileReadTool } from "./fileRead";
import { ListFilesTool } from "./listFiles";
import { GrepTool } from "./grep";
import { GlobTool } from "./glob";
import { FileEditTool } from "./fileEdit";
import { BashTool } from "./bash";
import { ArchitectTool } from "./architect";
import { TodoReadTool, TodoWriteTool } from "./todo";

describe("Tools Registry", () => {
  test("all tools have required fields", () => {
    const tools = [
      FileReadTool,
      ListFilesTool,
      GrepTool,
      GlobTool,
      FileEditTool,
      BashTool,
      ArchitectTool,
      TodoReadTool,
      TodoWriteTool,
    ];

    for (const tool of tools) {
      // Verify required fields exist
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);

      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);

      expect(tool.readonly).toBeDefined();
      expect(typeof tool.readonly).toBe("boolean");

      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });

  test("tool names are unique", () => {
    const tools = [
      FileReadTool,
      ListFilesTool,
      GrepTool,
      GlobTool,
      FileEditTool,
      BashTool,
      ArchitectTool,
      TodoReadTool,
      TodoWriteTool,
    ];

    const names = tools.map((t) => t.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });

  test("readonly classification is correct", () => {
    // Read-only tools
    expect(FileReadTool.readonly).toBe(true);
    expect(ListFilesTool.readonly).toBe(true);
    expect(GrepTool.readonly).toBe(true);
    expect(GlobTool.readonly).toBe(true);
    expect(ArchitectTool.readonly).toBe(true);
    expect(TodoReadTool.readonly).toBe(true);

    // Write tools
    expect(FileEditTool.readonly).toBe(false);
    expect(BashTool.readonly).toBe(false);
    expect(TodoWriteTool.readonly).toBe(true);
  });

  test("inputSchema can validate input", () => {
    // Test FileReadTool's schema
    const validInput = {
      filePath: "/tmp/test.txt",
      offset: 0,
      limit: 100,
    };

    const result = FileReadTool.inputSchema.safeParse(validInput);
    expect(result.success).toBe(true);

    // Test invalid input
    const invalidInput = {
      // Missing required field
      offset: "not a number", // Type error
    };

    const invalidResult = FileReadTool.inputSchema.safeParse(invalidInput);
    expect(invalidResult.success).toBe(false);
  });

  test("tool descriptions contain useful information", () => {
    const tools = [
      FileReadTool,
      ListFilesTool,
      GrepTool,
      GlobTool,
      FileEditTool,
      BashTool,
      ArchitectTool,
      TodoReadTool,
      TodoWriteTool,
    ];

    for (const tool of tools) {
      // Description should be long enough, include usage instructions
      expect(tool.description.length).toBeGreaterThan(50);

      // Should include some keywords
      const desc = tool.description.toLowerCase();
      expect(
        desc.includes("tool") ||
          desc.includes("use") ||
          desc.includes("read") ||
          desc.includes("write") ||
          desc.includes("execute") ||
          desc.includes("search") ||
          desc.includes("list") ||
          desc.includes("todo"),
      ).toBe(true);
    }
  });
});

describe("Tool Execution Context", () => {
  test("tools can handle abort signal", async () => {
    const controller = new AbortController();
    const context = {
      cwd: "/tmp",
      signal: controller.signal,
      approvalMode: "default" as const,
      sessionId: "test-session",
    };

    // Abort immediately
    controller.abort();

    // Test read-only tools
    const result = await FileReadTool.execute(
      { filePath: "/tmp/nonexistent.txt" },
      context,
    );

    // Should return aborted error
    expect(result).toHaveProperty("isError");
    if ("isError" in result) {
      expect(result.isError).toBe(true);
      expect(result.message).toBe("Aborted");
    }
  });
});

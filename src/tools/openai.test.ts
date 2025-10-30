import { describe, test, expect } from "vitest";
import { toolToOpenAIFormat, allToolsToOpenAIFormat } from "./openai";
import { ALL_TOOLS, TOOLS_BY_NAME } from "./index";
import type { ToolName } from "./runner.types";
import { FileReadTool } from "./fileRead";
import { ListFilesTool } from "./listFiles";
import { GrepTool } from "./grep";
import { BashTool } from "./bash";

describe("Tools Registry", () => {
  test("ALL_TOOLS contains all 9 tools", () => {
    expect(ALL_TOOLS).toHaveLength(9);

    const names = ALL_TOOLS.map((t) => t.name);
    expect(names).toContain("fileRead");
    expect(names).toContain("listFiles");
    expect(names).toContain("grep");
    expect(names).toContain("glob");
    expect(names).toContain("fileEdit");
    expect(names).toContain("bash");
    expect(names).toContain("architect");
    expect(names).toContain("todo_read");
    expect(names).toContain("todo_write");
  });

  test("TOOLS_BY_NAME can find tools by name", () => {
    expect(TOOLS_BY_NAME["fileRead"]).toBe(FileReadTool);
    expect(TOOLS_BY_NAME["listFiles"]).toBe(ListFilesTool);
    expect(TOOLS_BY_NAME["grep"]).toBe(GrepTool);
    expect(TOOLS_BY_NAME["bash"]).toBe(BashTool);
  });

  test("All tool names exist in mapping", () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOLS_BY_NAME[tool.name as ToolName]).toBe(tool);
    }
  });
});

describe("OpenAI Format Conversion", () => {
  test("toolToOpenAIFormat converts single tool", () => {
    const openaiTool = toolToOpenAIFormat(FileReadTool);

    // Verify top-level structure
    expect(openaiTool).toHaveProperty("type", "function");
    expect(openaiTool).toHaveProperty("function");

    // Verify function structure
    expect(openaiTool.function).toHaveProperty("name", "fileRead");
    expect(openaiTool.function).toHaveProperty("description");
    expect(openaiTool.function).toHaveProperty("parameters");

    // Verify description is string
    expect(openaiTool.function.description).toBeDefined();
    expect(typeof openaiTool.function.description).toBe("string");
    expect(openaiTool.function.description!.length).toBeGreaterThan(0);

    // Verify parameters is JSON Schema format
    const params = openaiTool.function.parameters as any;
    expect(params).toHaveProperty("type", "object");
    expect(params).toHaveProperty("properties");
    expect(params.properties).toHaveProperty("filePath");
  });

  test("Converted parameters contain correct fields", () => {
    const openaiTool = toolToOpenAIFormat(FileReadTool);
    const params = openaiTool.function.parameters as any;

    // FileReadTool has three fields: filePath, offset, limit
    expect(params.properties.filePath).toHaveProperty("type", "string");
    // offset and limit are int(), JSON Schema correctly converts to 'integer'
    expect(params.properties.offset).toHaveProperty("type", "integer");
    expect(params.properties.limit).toHaveProperty("type", "integer");

    // filePath is required
    expect(params.required).toContain("filePath");
    expect(params.required).toHaveLength(1); // Only filePath is required

    // offset and limit are optional (not in required array)
    expect(params.required).not.toContain("offset");
    expect(params.required).not.toContain("limit");
  });

  test("allToolsToOpenAIFormat batch converts all tools", () => {
    const openaiTools = allToolsToOpenAIFormat(ALL_TOOLS);

    // Should convert all 9 tools
    expect(openaiTools).toHaveLength(9);

    // Each should be a valid OpenAI tool
    for (const tool of openaiTools) {
      expect(tool.type).toBe("function");
      expect(tool.function).toHaveProperty("name");
      expect(tool.function).toHaveProperty("description");
      expect(tool.function).toHaveProperty("parameters");

      // Verify parameters format
      const params = tool.function.parameters as any;
      expect(params).toHaveProperty("type", "object");
      expect(params).toHaveProperty("properties");
    }
  });

  test("Converted tool names match original tools", () => {
    const openaiTools = allToolsToOpenAIFormat(ALL_TOOLS);
    const originalNames = ALL_TOOLS.map((t) => t.name);
    const convertedNames = openaiTools.map((t) => t.function.name);

    expect(convertedNames).toEqual(originalNames);
  });

  test("Can convert tools with optional fields", () => {
    // GrepTool has optional fields: path, glob
    const openaiTool = toolToOpenAIFormat(GrepTool);
    const params = openaiTool.function.parameters as any;

    expect(params.properties.pattern).toBeDefined();
    expect(params.properties.path).toBeDefined();
    expect(params.properties.glob).toBeDefined();

    // pattern is required
    expect(params.required).toContain("pattern");
  });

  test("Conversion result can be serialized to JSON", () => {
    const openaiTools = allToolsToOpenAIFormat(ALL_TOOLS);

    // Should be able to serialize successfully
    const json = JSON.stringify(openaiTools);
    expect(json).toBeDefined();

    // Should be able to parse back
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(openaiTools);
  });
});

describe("OpenAI API Compatibility", () => {
  test("Conversion result complies with OpenAI API specification", () => {
    const openaiTools = allToolsToOpenAIFormat([FileReadTool, BashTool]);

    // Simulate OpenAI API call payload
    const apiPayload = {
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Test" }],
      tools: openaiTools,
      stream: true,
    };

    // Verify payload structure is correct
    expect(apiPayload.tools).toHaveLength(2);
    expect(apiPayload.tools[0].type).toBe("function");
    expect(apiPayload.tools[0].function.name).toBe("fileRead");
    expect(apiPayload.tools[1].function.name).toBe("bash");
  });

  test("Each tool description is detailed enough", () => {
    const openaiTools = allToolsToOpenAIFormat(ALL_TOOLS);

    for (const tool of openaiTools) {
      // Description should be at least 50 characters (enough context for LLM)
      expect(tool.function.description).toBeDefined();
      expect(tool.function.description!.length).toBeGreaterThan(50);
    }
  });

  test("parameters use standard JSON Schema types", () => {
    const openaiTools = allToolsToOpenAIFormat(ALL_TOOLS);

    const validTypes = [
      "string",
      "number",
      "boolean",
      "object",
      "array",
      "integer",
    ];

    for (const tool of openaiTools) {
      const params = tool.function.parameters as any;

      if (params.properties) {
        for (const [key, prop] of Object.entries(
          params.properties as Record<string, any>,
        )) {
          // Each property should have type field
          expect(prop).toHaveProperty("type");

          // type should be valid JSON Schema type
          expect(validTypes).toContain(prop.type);
        }
      }
    }
  });
});

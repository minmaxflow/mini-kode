import { describe, it, expect } from "vitest";
import { calculateMentionContext } from "./context";

describe("calculateMentionContext", () => {
  it("should return null when not in mention mode", () => {
    const result = calculateMentionContext("help @src/utils", 15, false);
    expect(result).toBeNull();
  });

  it("should return null when no @ symbol found", () => {
    const result = calculateMentionContext("help me please", 15, true);
    expect(result).toBeNull();
  });

  it("should detect active mention with prefix", () => {
    const result = calculateMentionContext("help @src/", 10, true);
    expect(result).toEqual({
      prefix: "src/",
      start: 5,
    });
  });

  it("should return null for complete file with extension", () => {
    const result = calculateMentionContext(
      "help @src/utils/helper.ts",
      27,
      true,
    );
    expect(result).toBeNull();
  });

  it("should return null for mention with whitespace", () => {
    const result = calculateMentionContext("help @src/utils ", 16, true);
    expect(result).toBeNull();
  });

  it("should work with various file extensions", () => {
    const extensions = ["ts", "js", "tsx", "jsx", "json", "md", "py", "java"];

    extensions.forEach((ext) => {
      const result = calculateMentionContext(`@src/file.${ext}`, 14, true);
      expect(result).toBeNull();
    });
  });

  it("should handle incomplete file paths", () => {
    const testCases = [
      { input: "@src", cursor: 5, expected: { prefix: "src", start: 0 } },
      { input: "@src/", cursor: 6, expected: { prefix: "src/", start: 0 } },
      {
        input: "@src/utils/hel",
        cursor: 14,
        expected: { prefix: "src/utils/hel", start: 0 },
      },
      {
        input: "test @src/f",
        cursor: 11,
        expected: { prefix: "src/f", start: 5 },
      },
    ];

    testCases.forEach(({ input, cursor, expected }) => {
      const result = calculateMentionContext(input, cursor, true);
      expect(result).toEqual(expected);
    });
  });

  it("should handle empty mention text", () => {
    const result = calculateMentionContext("test @", 6, true);
    expect(result).toEqual({
      prefix: "",
      start: 5,
    });
  });

  it("should handle cursor at different positions", () => {
    // Cursor at end of mention
    const result1 = calculateMentionContext("help @src/util", 15, true);
    expect(result1).toEqual({
      prefix: "src/util",
      start: 5,
    });

    // Cursor before @ symbol - should not detect mention
    const result2 = calculateMentionContext("help @src/util", 4, true);
    expect(result2).toBeNull();

    // Cursor exactly at @ symbol position - should return null (no file selector)
    const result3 = calculateMentionContext("help @src/util", 5, true);
    expect(result3).toBeNull();
  });
});

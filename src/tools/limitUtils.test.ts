import { describe, it, expect } from "vitest";
import { limitText, limitString } from "./limitUtils";

describe("limitUtils", () => {
  describe("limitString", () => {
    it("should return original string when within limit", () => {
      const result = limitString("hello world", 20);
      expect(result.content).toBe("hello world");
      expect(result.truncated).toBe(false);
    });

    it("should truncate string when exceeding limit", () => {
      const result = limitString("hello world", 5);
      expect(result.content).toBe("hello... [truncated]");
      expect(result.truncated).toBe(true);
    });

    it("should use custom truncation indicator", () => {
      const result = limitString("hello world", 5, "...");
      expect(result.content).toBe("hello...");
      expect(result.truncated).toBe(true);
    });

    it("should handle empty string", () => {
      const result = limitString("", 10);
      expect(result.content).toBe("");
      expect(result.truncated).toBe(false);
    });

    it("should handle exact length match", () => {
      const result = limitString("hello", 5);
      expect(result.content).toBe("hello");
      expect(result.truncated).toBe(false);
    });
  });

  describe("limitText", () => {
    it("should return original text when within limits", () => {
      const text = "line1\nline2\nline3";
      const result = limitText(text);
      expect(result.content).toBe("line1\nline2\nline3");
      expect(result.truncated).toBe(false);
    });

    it("should limit number of lines", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line-${i}`);
      const text = lines.join("\n");
      const result = limitText(text, { maxLines: 5 });
      expect(result.content.split("\n")).toHaveLength(5);
      expect(result.content).toBe("line-0\nline-1\nline-2\nline-3\nline-4");
      expect(result.truncated).toBe(true);
    });

    it("should limit line length", () => {
      const text =
        "short\nthis is a very long line that should be truncated\nend";
      const result = limitText(text, { maxLineLength: 10 });
      const lines = result.content.split("\n");
      expect(lines[0]).toBe("short");
      expect(lines[1]).toBe("this is a ... [truncated]");
      expect(lines[2]).toBe("end");
      expect(result.truncated).toBe(false);
    });

    it("should handle both line count and line length limits", () => {
      const lines = Array.from(
        { length: 10 },
        (_, i) => `line-${i}-with-very-long-content-that-should-be-truncated`,
      );
      const text = lines.join("\n");
      const result = limitText(text, { maxLines: 3, maxLineLength: 10 });
      const outputLines = result.content.split("\n");

      expect(outputLines).toHaveLength(3);
      expect(outputLines[0]).toBe("line-0-wit... [truncated]");
      expect(outputLines[1]).toBe("line-1-wit... [truncated]");
      expect(outputLines[2]).toBe("line-2-wit... [truncated]");
      expect(result.truncated).toBe(true);
    });

    it("should handle empty text", () => {
      const result = limitText("");
      expect(result.content).toBe("");
      expect(result.truncated).toBe(false);
    });

    it("should handle single line text", () => {
      const result = limitText("single line of text");
      expect(result.content).toBe("single line of text");
      expect(result.truncated).toBe(false);
    });

    it("should use custom truncation indicator", () => {
      const text = "this is a very long line";
      const result = limitText(text, {
        maxLineLength: 10,
        truncateIndicator: "...",
      });
      expect(result.content).toBe("this is a ...");
      expect(result.truncated).toBe(false);
    });

    it("should handle Windows line endings", () => {
      const text = "line1\r\nline2\r\nline3";
      const result = limitText(text, { maxLines: 2 });
      expect(result.content).toBe("line1\nline2");
      expect(result.truncated).toBe(true);
    });

    it("should handle mixed line endings", () => {
      const text = "line1\r\nline2\nline3\rline4";
      const result = limitText(text, { maxLines: 3 });
      expect(result.content).toBe("line1\nline2\nline3");
      expect(result.truncated).toBe(true);
    });

    it("should handle offset", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line-${i}`);
      const text = lines.join("\n");
      const result = limitText(text, { offset: 5, maxLines: 3 });
      expect(result.content.split("\n")).toHaveLength(3);
      expect(result.content).toBe("line-5\nline-6\nline-7");
      expect(result.truncated).toBe(true);
    });

    it("should handle offset beyond text length", () => {
      const text = "line1\nline2\nline3";
      const result = limitText(text, { offset: 10 });
      expect(result.content).toBe("");
      expect(result.truncated).toBe(false);
    });

    it("should handle offset with no truncation", () => {
      const text = "line1\nline2\nline3";
      const result = limitText(text, { offset: 1 });
      expect(result.content).toBe("line2\nline3");
      expect(result.truncated).toBe(false);
    });

    it("should handle offset of zero", () => {
      const text = "line1\nline2\nline3";
      const result = limitText(text, { offset: 0, maxLines: 2 });
      expect(result.content).toBe("line1\nline2");
      expect(result.truncated).toBe(true);
    });
  });
});

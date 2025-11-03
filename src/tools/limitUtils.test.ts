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

    // Tests for actualOffset and actualLimit
    describe("actualOffset and actualLimit", () => {
      it("should return correct actualOffset and actualLimit for normal offset", () => {
        const lines = Array.from({ length: 10 }, (_, i) => `line-${i}`);
        const text = lines.join("\n");
        const result = limitText(text, { offset: 3, maxLines: 5 });

        expect(result.actualOffset).toBe(3);
        expect(result.actualLimit).toBe(5);
        expect(result.fileTotalLines).toBe(10);
        expect(result.content.split("\n")).toHaveLength(5);
        expect(result.content).toBe("line-3\nline-4\nline-5\nline-6\nline-7");
      });

      it("should handle offset beyond end of file", () => {
        const text = "line1\nline2\nline3";
        const result = limitText(text, { offset: 10, maxLines: 5 });

        expect(result.actualOffset).toBe(3); // Clamped to fileTotalLines
        expect(result.actualLimit).toBe(0); // No lines after offset
        expect(result.fileTotalLines).toBe(3);
        expect(result.content).toBe("");
        expect(result.truncated).toBe(false);
      });

      it("should handle maxLines beyond available lines after offset", () => {
        const text = "line1\nline2\nline3\nline4\nline5";
        const result = limitText(text, { offset: 3, maxLines: 10 });

        expect(result.actualOffset).toBe(3);
        expect(result.actualLimit).toBe(2); // Only 2 lines available after offset
        expect(result.fileTotalLines).toBe(5);
        expect(result.content).toBe("line4\nline5");
        expect(result.truncated).toBe(false);
      });

      it("should handle offset at end of file", () => {
        const text = "line1\nline2\nline3";
        const result = limitText(text, { offset: 3, maxLines: 5 });

        expect(result.actualOffset).toBe(3);
        expect(result.actualLimit).toBe(0);
        expect(result.fileTotalLines).toBe(3);
        expect(result.content).toBe("");
        expect(result.truncated).toBe(false);
      });

      it("should handle empty text with offset", () => {
        const text = "";
        const result = limitText(text, { offset: 5, maxLines: 10 });

        // Empty string split creates array with one empty element
        expect(result.actualOffset).toBe(1);
        expect(result.actualLimit).toBe(0);
        expect(result.fileTotalLines).toBe(1);
        expect(result.content).toBe("");
        expect(result.truncated).toBe(false);
      });

      it("should handle offset with single line", () => {
        const text = "single line";
        const result = limitText(text, { offset: 0, maxLines: 5 });

        expect(result.actualOffset).toBe(0);
        expect(result.actualLimit).toBe(1);
        expect(result.fileTotalLines).toBe(1);
        expect(result.content).toBe("single line");
        expect(result.truncated).toBe(false);
      });

      it("should handle offset with maxLines of zero", () => {
        const lines = Array.from({ length: 10 }, (_, i) => `line-${i}`);
        const text = lines.join("\n");
        const result = limitText(text, { offset: 2, maxLines: 0 });

        expect(result.actualOffset).toBe(2);
        expect(result.actualLimit).toBe(0);
        expect(result.fileTotalLines).toBe(10);
        expect(result.content).toBe("");
        expect(result.truncated).toBe(true); // 8 lines remaining after offset, but we want 0, so truncated
      });

      it("should handle large offset and small maxLines", () => {
        const lines = Array.from({ length: 100 }, (_, i) => `line-${i}`);
        const text = lines.join("\n");
        const result = limitText(text, { offset: 90, maxLines: 5 });

        expect(result.actualOffset).toBe(90);
        expect(result.actualLimit).toBe(5);
        expect(result.fileTotalLines).toBe(100);
        expect(result.truncated).toBe(true);
        expect(result.content.split("\n")).toHaveLength(5);
        expect(result.content).toBe(
          "line-90\nline-91\nline-92\nline-93\nline-94",
        );
      });
    });
  });
});

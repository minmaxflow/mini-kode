import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  FileEditTool,
  noteFileReadForEdit,
  checkStringMatch,
  calculateStartLineNumber,
} from "./fileEdit";
import { createTempProject } from "../utils/testHelpers";

describe("FileEditTool", () => {
  it("requires read-before-write", async () => {
    const dir = createTempProject({ fsPermissions: true });
    const file = path.join(dir, "a.txt");
    fs.writeFileSync(file, "hello", "utf8");
    const res = await FileEditTool.execute(
      { filePath: file, old_string: "hello", new_string: "world" },
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });

  it("applies unique replacement after read note", async () => {
    const dir = createTempProject({ fsPermissions: true });
    const file = path.join(dir, "b.txt");
    fs.writeFileSync(file, "x\ny\nz", "utf8");
    noteFileReadForEdit(file, fs.readFileSync(file, "utf8"));
    const res = await FileEditTool.execute(
      { filePath: file, old_string: "y", new_string: "Y" },
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected error");
    expect(res.success).toBe(true);
    expect(res.editStartLine).toBe(2); // Line 2 contains "y"
    const after = fs.readFileSync(file, "utf8");
    expect(after.includes("Y")).toBe(true);
  });

  it("creates a new file when old_string is empty", async () => {
    const dir = createTempProject({ fsPermissions: true });
    const file = path.join(dir, "new.txt");
    const res = await FileEditTool.execute(
      { filePath: file, old_string: "", new_string: "content" },
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected error");
    expect(res.success).toBe(true);
    expect(res.mode).toBe("create");
    expect(res.editStartLine).toBe(1); // New files start at line 1
    const after = fs.readFileSync(file, "utf8");
    expect(after).toBe("content");
  });

  it("errors when old_string not found", async () => {
    const dir = createTempProject({ fsPermissions: true });
    const file = path.join(dir, "c.txt");
    fs.writeFileSync(file, "foo", "utf8");
    noteFileReadForEdit(file, fs.readFileSync(file, "utf8"));
    const res = await FileEditTool.execute(
      { filePath: file, old_string: "bar", new_string: "baz" },
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });

  it("errors when old_string is not unique", async () => {
    const dir = createTempProject({ fsPermissions: true });
    const file = path.join(dir, "d.txt");
    fs.writeFileSync(file, "dup\ndup\nend", "utf8");
    noteFileReadForEdit(file, fs.readFileSync(file, "utf8"));
    const res = await FileEditTool.execute(
      { filePath: file, old_string: "dup", new_string: "DUP" },
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });
});

describe("checkStringMatch", () => {
  it("should return 'none' when substring is not found", () => {
    const content = "hello world";
    const substring = "xyz";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("none");
  });

  it("should return 'one' when substring is found exactly once", () => {
    const content = "hello world";
    const substring = "hello";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("one");
  });

  it("should return 'more' when substring is found multiple times", () => {
    const content = "hello world, hello universe";
    const substring = "hello";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("more");
  });

  it("should handle empty substring correctly", () => {
    const content = "hello world";
    const emptySubstring = "";

    const result = checkStringMatch(content, emptySubstring);

    expect(result).toBe("more");
  });

  it("should handle empty content with empty substring", () => {
    const content = "";
    const emptySubstring = "";

    const result = checkStringMatch(content, emptySubstring);

    expect(result).toBe("none");
  });

  it("should handle special characters correctly", () => {
    const content = "const regex = /test.*/g;";
    const substring = "/test.*/";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("one");
  });

  it("should handle newlines in substring", () => {
    const content = "line 1\nline 2\nline 3";
    const substring = "line 2";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("one");
  });

  it("should handle multiline substring", () => {
    const content = "start\nmiddle\nend";
    const substring = "start\nmiddle";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("one");
  });

  it("should handle overlapping matches correctly", () => {
    const content = "aaaa";
    const substring = "aa";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("more");
  });

  it("should handle very long content efficiently", () => {
    const content = "a".repeat(10000) + "unique" + "b".repeat(10000);
    const substring = "unique";

    const result = checkStringMatch(content, substring);

    expect(result).toBe("one");
  });
});

describe("calculateStartLineNumber", () => {
  it("should return the correct line number for single-line text", () => {
    const content = "line 1\nline 2\nline 3\nline 4";
    const searchText = "line 3";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(3);
  });

  it("should return the correct line number for multi-line text", () => {
    const content = "line 1\nline 2\nline 3\nline 4\nline 5";
    const searchText = "line 3\nline 4";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(3);
  });

  it("should return 1 when text is not found", () => {
    const content = "line 1\nline 2\nline 3";
    const searchText = "not found";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(1);
  });

  it("should return 1 when text is empty", () => {
    const content = "line 1\nline 2\nline 3";
    const searchText = "";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(1);
  });

  it("should handle single character matches", () => {
    const content = "a\nb\nc\nd";
    const searchText = "c";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(3);
  });

  it("should handle text with indentation", () => {
    const content = "line 1\n  indented line\nline 3";
    const searchText = "  indented line";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(2);
  });

  it("should handle complex multi-line matches", () => {
    const content = "function test() {\n  const x = 1;\n  return x;\n}\n\nfunction another() {\n  return 2;\n}";
    const searchText = "function test() {\n  const x = 1;\n  return x;\n}";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(1);
  });

  it("should handle content with only newlines", () => {
    const content = "\n\n\n";
    const searchText = "";

    const result = calculateStartLineNumber(content, searchText);

    expect(result).toBe(1);
  });
});

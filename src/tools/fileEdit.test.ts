import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { FileEditTool, noteFileReadForEdit } from "./fileEdit";
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

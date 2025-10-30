import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TodoReadTool, TodoWriteTool } from "./todo";
import { createTempProject } from "../utils/testHelpers";

describe("Todo tools", () => {
  it("read returns empty when missing", async () => {
    const dir = createTempProject();
    const res = await TodoReadTool.execute(
      {},
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.todos.length).toBe(0);
  });

  it("write then read returns persisted todos", async () => {
    const dir = createTempProject();
    const write = await TodoWriteTool.execute(
      { todos: [{ id: "1", content: "Do X", status: "pending" }] },
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in write) throw new Error("unexpected");
    const read = await TodoReadTool.execute(
      {},
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in read) throw new Error("unexpected");
    expect(read.todos.length).toBe(1);
    expect(read.todos[0].content).toBe("Do X");
  });

  it("handles malformed JSON gracefully", async () => {
    const dir = createTempProject();
    const file = path.join(
      dir,
      ".mini-kode",
      "sessions",
      "test-session",
      "todos.json",
    );
    const mini = path.dirname(file);
    if (!fs.existsSync(mini)) fs.mkdirSync(mini, { recursive: true });
    fs.writeFileSync(file, "{ not: valid json", "utf8");
    const res = await TodoReadTool.execute(
      {},
      { cwd: dir, approvalMode: "default", sessionId: "test-session" },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });
});

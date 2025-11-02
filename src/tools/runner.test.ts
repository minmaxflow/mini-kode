import { describe, it, expect } from "vitest";
import { runToolBatchConcurrent, executeSingleToolCall } from "./runner";
import { TodoWriteTool, TodoReadTool } from "./todo";
import { createTempProject } from "../utils/testHelpers";
import { clearSessionApprovals, addSessionGrant } from "../permissions";
import path from "path";
import fs from "fs";
import type { ToolCall } from "./runner.types";
import type { ListFilesResult, GrepResult } from "./types";

/**
 * Helper function to convert a tool and input to ToolCall format
 */
function createToolCall(
  requestId: string,
  toolName: string,
  input: Record<string, unknown>,
): ToolCall {
  return {
    requestId,
    toolName: toolName as any,
    status: "pending" as const,
    startedAt: new Date().toISOString(),
    input,
  };
}

describe("runner", () => {
  it("runs readonly tools in parallel", async () => {
    const proj = createTempProject();
    const file = path.join(proj, "a.txt");
    fs.writeFileSync(file, "ok", "utf8");
    const gen = runToolBatchConcurrent(
      [createToolCall("r1", "fileRead", { filePath: file })],
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    const first = await gen.next();
    if (first.done) throw new Error("expected a ToolCall");
    expect(first.value.status).toBe("success");
  });

  it("runs end-to-end flow with permissions and tools", async () => {
    const proj = createTempProject();
    const file = path.join(proj, "readme.md");
    fs.writeFileSync(file, "hello world", "utf8");
    const acc: ToolCall[] = [];
    for await (const r of runToolBatchConcurrent(
      [
        createToolCall("ls", "listFiles", { path: proj }),
        createToolCall("grep", "grep", {
          pattern: "hello",
          path: proj,
          include: "*.md",
        }),
      ],
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    ))
      acc.push(r);
    const ls = acc.find((r) => r.requestId === "ls")!.result as ListFilesResult;
    const grep = acc.find((r) => r.requestId === "grep")!.result as GrepResult;
    if ("isError" in ls || "isError" in grep) throw new Error("unexpected");
    expect(ls.entries.length).toBeGreaterThan(0);
    expect(grep.matches.length).toBeGreaterThan(0);

    const write = await TodoWriteTool.execute(
      { todos: [{ id: "t1", content: "done", status: "completed" }] },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in write) throw new Error("unexpected");
    const read = await TodoReadTool.execute(
      {},
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in read) throw new Error("unexpected");
    expect(read.todos.length).toBe(1);
  });

  it("runToolBatch: readonly parallel", async () => {
    const proj = createTempProject();
    const toolCalls = [1, 2, 3, 4].map((n) =>
      createToolCall(`r${n}`, "listFiles", { path: proj }),
    );
    const out: ToolCall[] = [];
    for await (const r of runToolBatchConcurrent(toolCalls, {
      cwd: proj,
      approvalMode: "default",
      sessionId: "test-session",
    }))
      out.push(r);
    expect(out.length).toBe(4);
    expect(out.every((r) => r.status === "success")).toBe(true);
  });

  it("executeSingleToolCall: single tool execution", async () => {
    const proj = createTempProject();

    // Execute first tool
    const result1 = await executeSingleToolCall(
      createToolCall("w1", "todo_write", {
        todos: [{ id: "t1", content: "First task", status: "pending" }],
      }),
      { cwd: proj, approvalMode: "yolo", sessionId: "test-session" },
    );

    expect(result1.status).toBe("success");

    // Execute second tool (updating the same task)
    const result2 = await executeSingleToolCall(
      createToolCall("w2", "todo_write", {
        todos: [{ id: "t1", content: "Updated task", status: "completed" }],
      }),
      { cwd: proj, approvalMode: "yolo", sessionId: "test-session" },
    );

    expect(result2.status).toBe("success");

    // Verify the final state
    const finalResult = await TodoReadTool.execute(
      {},
      { cwd: proj, approvalMode: "yolo", sessionId: "test-session" },
    );
    if ("isError" in finalResult) throw new Error("Failed to read todos");
    expect(finalResult.todos[0].status).toBe("completed");
    expect(finalResult.todos[0].content).toBe("Updated task");
  });

  it("emits mixed results: success, error, permission_required in one batch", async () => {
    const proj = createTempProject();
    const okFile = path.join(proj, "ok.txt");
    fs.writeFileSync(okFile, "ok", "utf8");
    const outside = path.join(path.dirname(proj), "outside.txt");
    fs.writeFileSync(outside, "x", "utf8");
    const out: ToolCall[] = [];
    for await (const r of runToolBatchConcurrent(
      [
        // success
        createToolCall("succ", "fileRead", { filePath: okFile }),
        // error: invalid grep pattern
        createToolCall("err", "grep", {
          pattern: "([",
          path: proj,
          include: undefined,
        }),
        // success: fileRead is readonly, no permission required (logs warning for outside reads)
        createToolCall("perm", "fileRead", { filePath: outside }),
      ],
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    ))
      out.push(r);
    const byId = Object.fromEntries(out.map((r) => [r.requestId, r]));
    expect(byId["succ"].status).toBe("success");
    const errRes = byId["err"];
    expect(errRes.status).toBe("error");
    expect(
      errRes.result && "isError" in errRes.result ? errRes.result.message : "",
    ).toContain("Invalid regex pattern");
    // fileRead is now readonly, so it succeeds even for outside files (with warning log)
    expect(byId["perm"].status).toBe("success");
  });

  it("executeSingleToolCall: permission_required for bash without approval", async () => {
    const proj = createTempProject();
    const result = await executeSingleToolCall(
      createToolCall("b1", "bash", { command: "echo ok" }),
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    expect(result.status === "permission_required").toBe(true);
  });

  it("succeeds for fs read even outside project (fileRead is readonly)", async () => {
    const proj = createTempProject();
    const outside = path.join(path.dirname(proj), "outside");
    fs.writeFileSync(outside, "x", "utf8");
    const out: ToolCall[] = [];
    for await (const r of runToolBatchConcurrent(
      [createToolCall("r", "fileRead", { filePath: outside })],
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    ))
      out.push(r);
    // fileRead is readonly, so it succeeds even for outside files (with warning log)
    expect(out[0].status).toBe("success");
  });

  it("executeSingleToolCall: session bash approval workflow", async () => {
    clearSessionApprovals();
    const proj = createTempProject();

    // First execution should fail with permission_required
    const result1 = await executeSingleToolCall(
      createToolCall("b1", "bash", { command: "echo ok" }),
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    expect(result1.status === "permission_required").toBe(true);

    // Grant approval and retry
    addSessionGrant({
      type: "bash",
      command: "echo:*",
      grantedAt: new Date().toISOString(),
    });
    const result2 = await executeSingleToolCall(
      createToolCall("b2", "bash", { command: "echo ok" }),
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    expect(result2.status).toBe("success");
    clearSessionApprovals();
  });
});

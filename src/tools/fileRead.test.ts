import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { FileReadTool } from "./fileRead";
import { createTempProject } from "../utils/testHelpers";

describe("FileReadTool", () => {
  it("returns error for non-existent file", async () => {
    const res = await FileReadTool.execute(
      { filePath: "/definitely/not/here.txt" },
      {
        cwd: process.cwd(),
        approvalMode: "default",
        sessionId: "test-session",
      },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });

  it("reads a file with offset/limit", async () => {
    const proj = createTempProject();
    const file = path.join(proj, "sample.txt");
    const lines = Array.from({ length: 20 }, (_, i) => `line-${i}`);
    fs.writeFileSync(file, lines.join("\n"), "utf8");
    const res = await FileReadTool.execute(
      { filePath: file, offset: 5, limit: 5 },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.content.split("\n")[0]).toBe("line-5");
    expect(res.fileTotalLines).toBe(20); // LLM can use this to determine if more content exists
  });

  it("errors when reading a directory", async () => {
    const proj = createTempProject();
    const res = await FileReadTool.execute(
      { filePath: proj },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });
});

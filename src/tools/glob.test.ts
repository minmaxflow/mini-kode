import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { GlobTool } from "./glob";
import { createTempProject } from "../utils/testHelpers";

describe("GlobTool", () => {
  it("returns result object", async () => {
    const proj = createTempProject();
    fs.writeFileSync(path.join(proj, "a.md"), "a", "utf8");
    const res = await GlobTool.execute(
      { pattern: "*.md", path: proj },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) {
      throw new Error("unexpected error in glob tool");
    }
    expect(res.type).toBe("glob");
    expect(res.files.length).toBe(1);
  });

  it("matches files by pattern and sorts by mtime", async () => {
    const proj = createTempProject();
    const a = path.join(proj, "a.md");
    const b = path.join(proj, "b.md");
    fs.writeFileSync(a, "a", "utf8");
    await new Promise((r) => setTimeout(r, 5));
    fs.writeFileSync(b, "b", "utf8");
    const res = await GlobTool.execute(
      { pattern: "**/*.md", path: proj },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.files[0].endsWith("b.md")).toBe(true);
    expect(res.files[1].endsWith("a.md")).toBe(true);
  });
});

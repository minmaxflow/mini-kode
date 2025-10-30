import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { GrepTool } from "./grep";
import { createTempProject } from "../utils/testHelpers";

describe("GrepTool", () => {
  it("rejects invalid regex", async () => {
    const res = await GrepTool.execute(
      { pattern: "([", path: undefined, glob: undefined },
      {
        cwd: process.cwd(),
        approvalMode: "default",
        sessionId: "test-session",
      },
    );
    if ("isError" in res) {
      expect(res.isError).toBe(true);
    } else {
      throw new Error("Expected error");
    }
  });

  it("finds matches in files and reports line numbers", async () => {
    const proj = createTempProject();
    const a = path.join(proj, "a.txt");
    const b = path.join(proj, "b.ts");
    fs.writeFileSync(a, "alpha\nbeta\nalpha", "utf8");
    fs.writeFileSync(b, "const alpha = 1;\n", "utf8");
    const res = await GrepTool.execute(
      { pattern: "alpha", path: proj, glob: "**/*.txt" },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.matches.length).toBe(2);
    expect(res.matches.some((m) => m.filePath === a)).toBe(true);
    expect(res.matches.some((m) => m.filePath === b)).toBe(false);
  });
});

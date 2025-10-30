import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ListFilesTool } from "./listFiles";
import { createTempProject } from "../utils/testHelpers";

describe("ListFilesTool", () => {
  it("handles non-existent path", async () => {
    const res = await ListFilesTool.execute(
      { path: "/non/existent/path" },
      {
        cwd: process.cwd(),
        approvalMode: "default",
        sessionId: "test-session",
      },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });

  it("lists files and directories", async () => {
    const proj = createTempProject();
    const dir = path.join(proj, "sub");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(proj, "a.txt"), "a", "utf8");
    const res = await ListFilesTool.execute(
      { path: proj },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    const names = res.entries.map((e) => e.name);
    expect(names.includes("a.txt")).toBe(true);
    expect(names.includes("sub")).toBe(true);
  });
});

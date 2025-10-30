import { describe, it, expect } from "vitest";
import { BashTool } from "./bash";
import { createTempProject } from "../utils/testHelpers";

describe("BashTool", () => {
  it("rejects banned network command", async () => {
    const res = await BashTool.execute(
      { command: "curl https://example.com" },
      {
        cwd: process.cwd(),
        approvalMode: "default",
        sessionId: "test-session",
      },
    );
    expect("isError" in res ? res.isError : false).toBe(true);
  });

  it("executes allowed command when approved by policy", async () => {
    const proj = createTempProject({ bashAllowPrefixes: ["echo:*"] });
    const res = await BashTool.execute(
      { command: "echo hello" },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.stdout.includes("hello")).toBe(true);
  });

  it("enforces timeout for long-running command", async () => {
    const proj = createTempProject({ bashAllowPrefixes: ["sleep:*"] });
    const res = await BashTool.execute(
      { command: "sleep 1", timeout: 50 },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.durationMs).toBeGreaterThanOrEqual(50);
    expect(res.durationMs).toBeLessThan(1000);
  });
});

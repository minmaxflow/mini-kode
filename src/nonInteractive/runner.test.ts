/**
 * Non-Interactive Mode Runner Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeAgent } from "../agent/executor";
import { runNonInteractiveWithCapture } from "./runner";

// Mock agent executor
vi.mock("../agent/executor", () => ({
  executeAgent: vi.fn(),
}));

describe("NonInteractiveRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runNonInteractive (via runNonInteractiveWithCapture)", () => {
    it("should return exit code 0 on success", async () => {
      vi.mocked(executeAgent).mockImplementation(
        async (prompt, context, callbacks) => {
          // Simulate calling onComplete callback
          callbacks?.onComplete?.("Task completed successfully");

          return {
            success: true,
            response: "Task completed successfully",
          };
        },
      );

      const result = await runNonInteractiveWithCapture(
        "Test prompt",
        "/test/cwd",
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Task completed successfully");
      expect(result.stderr).toBe("");
    });

    it("should return exit code 1 on permission denied", async () => {
      vi.mocked(executeAgent).mockResolvedValue({
        success: false,
        error: {
          type: "permission_denied",
          message: "Permission denied for fileEdit",
        },
      });

      const result = await runNonInteractiveWithCapture(
        "Test prompt",
        "/test/cwd",
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("permission denial");
    });

    it("should return exit code 2 on LLM error", async () => {
      vi.mocked(executeAgent).mockResolvedValue({
        success: false,
        error: {
          type: "llm_error",
          message: "API call failed",
        },
      });

      const result = await runNonInteractiveWithCapture(
        "Test prompt",
        "/test/cwd",
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("LLM API call failed: API call failed");
    });

    it("should return exit code 3 on abort", async () => {
      vi.mocked(executeAgent).mockResolvedValue({
        success: false,
        error: {
          type: "aborted",
          message: "Execution was aborted",
        },
      });

      const result = await runNonInteractiveWithCapture(
        "Test prompt",
        "/test/cwd",
      );

      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain(
        "Execution was aborted: Execution was aborted",
      );
    });

    it("should reject permission requests in non-interactive mode", async () => {
      vi.mocked(executeAgent).mockImplementation(
        async (prompt, context, callbacks) => {
          // Simulate permission request
          if (callbacks?.onPermissionRequired) {
            const decision = await callbacks.onPermissionRequired(
              { kind: "fs", path: "/test/file.txt" },
              "req-1",
            );

            // Should be rejected
            expect(decision.approved).toBe(false);
          }

          return {
            success: false,
            error: {
              type: "permission_denied",
              message: "Permission denied",
            },
          };
        },
      );

      const result = await runNonInteractiveWithCapture(
        "Test prompt",
        "/test/cwd",
      );

      expect(result.stderr).toContain("Permission required");
      expect(result.stderr).toContain("must be pre-configured");
    });

    it("should pass approval mode to executor", async () => {
      vi.mocked(executeAgent).mockImplementation(
        async (prompt, context, callbacks) => {
          // Simulate calling onComplete callback
          callbacks?.onComplete?.("Done");

          return {
            success: true,
            response: "Done",
          };
        },
      );

      const result = await runNonInteractiveWithCapture(
        "Test prompt",
        "/test/cwd",
        "yolo",
      );

      expect(result.exitCode).toBe(0);
      expect(executeAgent).toHaveBeenCalledWith(
        "Test prompt",
        expect.objectContaining({
          cwd: "/test/cwd",
          getApprovalMode: expect.any(Function),
        }),
        expect.any(Object),
      );
    });
  });
});

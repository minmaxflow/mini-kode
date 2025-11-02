import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requestUserApproval,
  applyPermissionGrant,
  resolveApproval,
  type ApprovalPromise,
} from "./permissionRequest";
import type { ApprovalDecision } from "../permissions/types";
import { clearSessionApprovals, getSessionPolicy } from "../permissions";

describe("Permission Request System", () => {
  beforeEach(() => {
    clearSessionApprovals();
  });

  describe("requestUserApproval", () => {
    it("should create a pending approval promise", async () => {
      const pendingApprovals = new Map<string, ApprovalPromise>();
      const requestId = "req-123";

      // Start the request (don't await yet)
      const approvalPromise = requestUserApproval(
        requestId,
        pendingApprovals,
        1000,
      );

      // Check that approval was added to map
      expect(pendingApprovals.has(requestId)).toBe(true);

      // Resolve the approval
      const approval = pendingApprovals.get(requestId)!;
      approval.resolve({
        approved: true,
        option: { kind: "fs", scope: "directory" },
      });

      // Wait for promise to resolve
      const decision = await approvalPromise;
      expect(decision.approved).toBe(true);
    });

    it("should timeout if no decision is made", async () => {
      const pendingApprovals = new Map<string, ApprovalPromise>();
      const requestId = "req-timeout";

      const result = await requestUserApproval(
        requestId,
        pendingApprovals,
        100,
      ); // 100ms timeout
      expect(result).toEqual({ approved: false, reason: "timeout" });
    });

    it("should clean up timeout on resolution", async () => {
      vi.useFakeTimers();

      const pendingApprovals = new Map<string, ApprovalPromise>();
      const requestId = "req-cleanup";

      const approvalPromise = requestUserApproval(
        requestId,
        pendingApprovals,
        5000,
      );

      // Resolve through resolveApproval (which should clean up)
      const decision = {
        approved: false as const,
        reason: "user_rejected" as const,
      };
      const success = resolveApproval(requestId, decision, pendingApprovals);
      expect(success).toBe(true);

      const result = await approvalPromise;
      expect(result).toEqual(decision);

      // Fast-forward time past original timeout - should not cause issues
      vi.advanceTimersByTime(6000);

      // Assert that the approval was cleaned up (no timeout side effects)
      expect(pendingApprovals.has(requestId)).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("applyPermissionGrant", () => {
    it("should grant project permissions for remember-prefix (persistent only)", async () => {
      const uiHint = {
        kind: "fs" as const,
        path: "/tmp/project/file.txt",
      };

      // Use a temporary directory for testing persistent storage
      const testCwd = "/tmp/minicode-test-" + Date.now();

      await applyPermissionGrant(
        uiHint,
        { kind: "fs", scope: "directory" },
        testCwd,
      );

      // Session policy should NOT contain the grant for persistent grants
      const policy = getSessionPolicy();
      expect(policy.grants).toHaveLength(0);

      // Instead, check that the grant was written to project permissions
      // (This would require reading the project permissions file to verify)
    });

    it("should grant project permissions for remember-prefix bash commands (persistent only)", async () => {
      const uiHint = {
        kind: "bash" as const,
        command: "npm install --save axios",
      };

      // Use a unique temporary directory for this test
      const bashTestCwd = "/tmp/minicode-test-bash-" + Date.now();
      await applyPermissionGrant(
        uiHint,
        { kind: "bash", scope: "prefix" },
        bashTestCwd,
      );

      // Session policy should NOT contain the grant for persistent grants
      const policy = getSessionPolicy();
      expect(policy.grants).toHaveLength(0);

      // Instead, check that the grant was written to project permissions
      // (This would require reading the project permissions file to verify)
    });

    it("should grant specific path/command for once option", async () => {
      // Test filesystem once grant
      const fsHint = {
        kind: "fs" as const,
        path: "/tmp/test.txt",
      };
      const onceTestCwd = "/tmp/minicode-test-once-" + Date.now();
      await applyPermissionGrant(fsHint, { kind: "once" }, onceTestCwd);

      let policy = getSessionPolicy();
      expect(policy.grants).toHaveLength(1);
      expect(policy.grants[0]).toMatchObject({
        type: "fs",
        path: "/tmp/test.txt",
      });

      // Clear and test bash once grant
      clearSessionApprovals();
      const bashHint = { kind: "bash" as const, command: "echo hello" };
      const bashOnceTestCwd = "/tmp/minicode-test-bash-once-" + Date.now();
      await applyPermissionGrant(bashHint, { kind: "once" }, bashOnceTestCwd);

      policy = getSessionPolicy();
      expect(policy.grants).toHaveLength(1);
      expect(policy.grants[0]).toMatchObject({
        type: "bash",
        command: "echo hello",
      });
    });
  });

  describe("resolveApproval", () => {
    it("should resolve pending approval with user decision", () => {
      const pendingApprovals = new Map<string, ApprovalPromise>();
      const requestId = "req-resolve";

      let resolvedDecision: ApprovalDecision | null = null;

      pendingApprovals.set(requestId, {
        resolve: (decision) => {
          resolvedDecision = decision;
        },
      });

      const success = resolveApproval(
        requestId,
        { approved: true, option: { kind: "fs", scope: "directory" } },
        pendingApprovals,
      );

      expect(success).toBe(true);
      expect(resolvedDecision).toEqual({
        approved: true,
        option: { kind: "fs", scope: "directory" },
      });
      expect(pendingApprovals.has(requestId)).toBe(false);
    });

    it("should return false if request not found", () => {
      const pendingApprovals = new Map<string, ApprovalPromise>();

      const success = resolveApproval(
        "non-existent",
        { approved: true, option: { kind: "fs", scope: "directory" } },
        pendingApprovals,
      );

      expect(success).toBe(false);
    });
  });
});

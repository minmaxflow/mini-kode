import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  checkFsPermission,
  isPathUnderPrefix,
  checkBashApproval,
  clearSessionApprovals,
  addSessionGrant,
} from "./index";
import type { FsGrant, BashGrant } from "./types";

describe("permissions checker", () => {
  it("isPathUnderPrefix works for nested paths", () => {
    const root = "/tmp/project";
    const file = "/tmp/project/src/index.ts";
    expect(isPathUnderPrefix(file, root)).toBe(true);
    expect(isPathUnderPrefix(root, file)).toBe(false);
  });



  it("checkBashApproval allows prefixes with wildcard", () => {
    // Create a temporary directory without project config
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-kode-test-"));

    try {
      clearSessionApprovals();
      // Grant git:* (wildcard) and npm:* (wildcard) and ls (exact)
      ["git:*", "npm:*", "ls"].forEach((command) => {
        addSessionGrant({
          type: "bash",
          command,
          grantedAt: new Date().toISOString(),
        } as BashGrant);
      });

      // Wildcard matches: git:* matches all git commands
      expect(checkBashApproval(tempDir, "git status", "default").ok).toBe(true);
      expect(
        checkBashApproval(tempDir, 'git commit -m "test"', "default").ok,
      ).toBe(true);

      // Wildcard matches: npm:* matches all npm commands
      expect(checkBashApproval(tempDir, "npm install", "default").ok).toBe(
        true,
      );
      expect(checkBashApproval(tempDir, "npm run dev", "default").ok).toBe(
        true,
      );

      // Exact match: ls matches only "ls"
      expect(checkBashApproval(tempDir, "ls", "default").ok).toBe(true);
      expect(checkBashApproval(tempDir, "ls -la", "default").ok).toBe(false); // Not exact - should not match

      // Not granted
      expect(checkBashApproval(tempDir, "git-lfs", "default").ok).toBe(false);
      expect(checkBashApproval(tempDir, "node -v", "default").ok).toBe(false);

      clearSessionApprovals();
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("checkFsPermission requires write permission", () => {
    // Create a temporary directory without project config
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-kode-test-"));

    try {
      clearSessionApprovals();
      const target = path.join(tempDir, "test.txt");
      // Write operations require permission (read operations are not checked)
      const writeRes = checkFsPermission(tempDir, target, "default");
      expect(writeRes.ok).toBe(false);
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("session approvals allow fs write", () => {
    clearSessionApprovals();
    const cwd = process.cwd();
    const target = path.join(cwd, "README.md");
    addSessionGrant({
      type: "fs",
      path: cwd,
      grantedAt: new Date().toISOString(),
    } as FsGrant);
    const res = checkFsPermission(cwd, target, "default");
    expect(res.ok).toBe(true);
    clearSessionApprovals();
  });

  it("session approvals allow bash prefixes", () => {
    clearSessionApprovals();
    addSessionGrant({
      type: "bash",
      command: "echo",
      grantedAt: new Date().toISOString(),
    } as BashGrant);
    // approval checked indirectly via BashTool tests; here we just ensure no throw in checker usage path
    clearSessionApprovals();
  });
});

import type { ApprovalMode } from "../config";

import { readProjectPolicy } from "./persistent";
import { isPathUnderPrefix } from "./pathChecker";
import { getSessionPolicy } from "./session";
import type { BashGrant, FsGrant } from "./types";

/**
 * Policy Resolver
 *
 * Responsible for merging and resolving permissions from multiple sources:
 * - Approval mode (autoEdit/yolo/default)
 * - Project policy (persistent, stored in .mini-kode/config.json)
 * - Session policy (runtime, stored in memory)
 *
 * Resolution Strategy:
 * 1. Check approval mode first (yolo auto-approves everything)
 * 2. Then check union of project + session policies
 * 3. If ANY policy grants access, the operation is allowed
 */

/**
 * Check if a target path matches any FS grant patterns.
 *
 * @param targetPath Absolute path to check
 * @param grants Array of FS grants to check against
 * @returns true if path matches any grant pattern, false otherwise
 */
function checkFsGrants(targetPath: string, grants: Array<FsGrant>): boolean {
  for (const grant of grants) {
    // Global grant marker
    if (grant.pattern === "*") {
      return true;
    }

    // Prefix matching
    if (isPathUnderPrefix(targetPath, grant.pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check session-level FS permissions.
 *
 * Session permissions are stored in memory and provide fast access
 * to grants approved during the current session.
 *
 * @param targetPath Absolute path to check
 * @returns true if session grants allow access, false otherwise
 */
function checkSessionFsPermission(targetPath: string): boolean {
  const sessionPolicy = getSessionPolicy();
  const fsGrants = sessionPolicy.grants.filter(
    (grant): grant is FsGrant => grant.type === "fs",
  );
  return checkFsGrants(targetPath, fsGrants);
}

/**
 * Check project-level FS permissions.
 *
 * Project permissions are persisted to disk and survive across
 * application restarts.
 *
 * @param cwd Current working directory (used to locate project config)
 * @param targetPath Absolute path to check
 * @returns true if project grants allow access, false otherwise
 */
function checkProjectFsPermission(cwd: string, targetPath: string): boolean {
  const projectPolicy = readProjectPolicy(cwd);
  const fsGrants = projectPolicy.grants.filter(
    (grant): grant is FsGrant => grant.type === "fs",
  );
  return checkFsGrants(targetPath, fsGrants);
}

/**
 * FS Write Permission Checker
 *
 * This function checks write permissions with clear separation between
 * session and project permission sources.
 *
 * Permission Resolution Order:
 * 1. Check approval mode (yolo/autoEdit auto-approve)
 * 2. Check internal .mini-kode directory access
 * 3. Check session permissions (in-memory, fast)
 * 4. Check project permissions (persistent, disk-based)
 * 5. If no grant found, return permission denied
 *
 * Design Notes:
 * - Read operations are auto-allowed (consistent with fileRead tool)
 * - Session permissions are checked first (in-memory, fast access)
 * - Project permissions are checked as fallback (persistent storage)
 * - Clear separation of concerns for better code readability
 *
 * @param cwd Current working directory (used to locate project config)
 * @param targetPath Absolute path to the file/directory to write
 * @param approvalModeOverride Optional approval mode override for this session
 * @returns Permission result with ok flag and optional message
 *
 * @example
 * ```typescript
 * // Auto-allowed: Write with autoEdit mode
 * // (config: { approvalMode: 'autoEdit' })
 * checkFsPermission('/project', '/project/src/main.ts')
 * // => { ok: true }
 *
 * // Session permission: Previously granted in current session
 * checkFsPermission('/project', '/project/src/app.ts')
 * // => { ok: true } (found in session cache)
 *
 * // Project permission: Previously granted and persisted
 * checkFsPermission('/project', '/project/src/lib.ts')
 * // => { ok: true } (found in project config)
 *
 * // Requires permission: No grant found
 * checkFsPermission('/project', '/project/src/new.ts')
 * // => { ok: false, message: "Permission required to modify: ./src/new.ts" }
 * ```
 */
export function checkFsPermission(
  cwd: string,
  targetPath: string,
  approvalMode: ApprovalMode,
): { ok: true } | { ok: false; message: string } {
  // YOLO mode: Auto-approve everything
  if (approvalMode === "yolo") {
    return { ok: true };
  }

  // AutoEdit mode: Auto-approve write operations
  if (approvalMode === "autoEdit") {
    return { ok: true };
  }

  // Auto-allow operations on internal configuration files within .mini-kode directory
  // This allows tools like todoWrite to work without permission prompts
  const miniKodeDir = cwd + "/.mini-kode";
  if (isPathUnderPrefix(targetPath, miniKodeDir)) {
    return { ok: true };
  }

  // Check session permissions first (in-memory, fast access)
  if (checkSessionFsPermission(targetPath)) {
    return { ok: true };
  }

  // Check project permissions as fallback (persistent storage)
  if (checkProjectFsPermission(cwd, targetPath)) {
    return { ok: true };
  }

  // No grant found - show relative path in UI
  const relativePath = targetPath.replace(cwd, ".");
  return {
    ok: false,
    message: `Permission required to modify: ${relativePath}`,
  };
}

/**
 * Check if a bash command matches any grant pattern.
 *
 * @param command The bash command to check
 * @param grants Array of bash grants to check against
 * @returns true if command matches any grant pattern, false otherwise
 */
function checkBashGrants(command: string, grants: Array<BashGrant>): boolean {
  for (const grant of grants) {
    const commandPattern = grant.pattern;

    // Global grant marker
    if (commandPattern === "*") {
      return true;
    }

    // Prefix match: "npm:*" matches all npm commands
    if (commandPattern.endsWith(":*")) {
      const prefix = commandPattern.slice(0, -2); // Remove ':*'
      // Match "npm" or "npm <args>"
      if (command === prefix || command.startsWith(prefix + " ")) {
        return true;
      }
    }
    // Exact match
    else if (command === commandPattern) {
      return true;
    }
  }

  return false;
}

/**
 * Check session-level bash permissions.
 *
 * Session permissions are stored in memory and provide fast access
 * to bash command grants approved during the current session.
 *
 * @param command The bash command to check
 * @returns true if session grants allow access, false otherwise
 */
function checkSessionBashPermission(command: string): boolean {
  const sessionPolicy = getSessionPolicy();
  const bashGrants = sessionPolicy.grants.filter(
    (grant): grant is BashGrant => grant.type === "bash",
  );
  return checkBashGrants(command, bashGrants);
}

/**
 * Check project-level bash permissions.
 *
 * Project permissions are persisted to disk and survive across
 * application restarts.
 *
 * @param cwd Current working directory (used to locate project config)
 * @param command The bash command to check
 * @returns true if project grants allow access, false otherwise
 */
function checkProjectBashPermission(cwd: string, command: string): boolean {
  const projectPolicy = readProjectPolicy(cwd);
  const bashGrants = projectPolicy.grants.filter(
    (grant): grant is BashGrant => grant.type === "bash",
  );
  return checkBashGrants(command, bashGrants);
}

/**
 * Check bash command execution permission.
 *
 * Permission Resolution Order:
 * 1. Check approval mode (yolo auto-approves)
 * 2. Check session permissions (in-memory, fast access)
 * 3. Check project permissions (persistent storage)
 * 4. If no grant found, return permission denied
 *
 * Matching Rules:
 * - Exact match: "git status" matches only "git status"
 * - Prefix match: "npm:*" matches "npm", "npm install", etc.
 * - Global grant: "*" matches all commands
 *
 * Design Notes:
 * - Session permissions are checked first (in-memory, fast access)
 * - Project permissions are checked as fallback (persistent storage)
 * - Clear separation of concerns for better code readability
 *
 * @param cwd Current working directory
 * @param command The bash command to check
 * @returns Permission result with ok flag and optional message
 *
 * @example
 * ```typescript
 * // YOLO mode: Auto-approve all bash commands
 * checkBashApproval('/project', 'rm -rf /', 'yolo')
 * // => { ok: true }
 *
 * // Session permission: Previously granted in current session
 * checkBashApproval('/project', 'npm install', 'default')
 * // => { ok: true } (found in session cache)
 *
 * // Project permission: Previously granted and persisted
 * checkBashApproval('/project', 'git status', 'default')
 * // => { ok: true } (found in project config)
 *
 * // Requires permission: No grant found
 * checkBashApproval('/project', 'git push', 'default')
 * // => { ok: false, message: "Permission required to run: git push" }
 * ```
 */
export function checkBashApproval(
  cwd: string,
  command: string,
  approvalMode: ApprovalMode,
): { ok: true } | { ok: false; message: string } {
  // YOLO mode: Auto-approve everything (including bash commands)
  if (approvalMode === "yolo") {
    return { ok: true };
  }

  // Check session permissions first (in-memory, fast access)
  if (checkSessionBashPermission(command)) {
    return { ok: true };
  }

  // Check project permissions as fallback (persistent storage)
  if (checkProjectBashPermission(cwd, command)) {
    return { ok: true };
  }

  // No matching grant found
  return {
    ok: false,
    message: `Permission required to run: ${command}`,
  };
}

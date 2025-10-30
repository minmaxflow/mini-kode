import type { FsGrant, BashGrant, ProjectPolicy } from "./types";
import {
  readProjectPermissions,
  writeProjectPermissions,
  updateProjectPermissions,
} from "./fileManager";

/**
 * ========================================================================
 * PERSISTENT PERMISSIONS (File-Based Storage)
 * ========================================================================
 *
 * Persistent permissions that are stored in .mini-kode/permissions.json and
 * survive across application restarts. These permissions represent user
 * choices to "remember" access for future sessions.
 *
 * ## STORAGE DETAILS
 *
 * - **Location**: .mini-kode/permissions.json in project root
 * - **Format**: JSON file with grants array
 * - **Scope**: Project-level, shared across sessions
 * - **Persistence**: Survives application restarts
 *
 * ## PERMISSION GRANT TYPES
 *
 * ### File System (FS) Grants:
 * - Pattern: File path pattern (e.g., "/project/src", "/project/src/*.ts")
 * - Global: "*" pattern grants access to all files
 * - Examples:
 *   - { type: "fs", pattern: "/project/src" } - Access to entire src directory
 *   - { type: "fs", pattern: "/project/src/app.ts" } - Access to specific file
 *   - { type: "fs", pattern: "*" } - Global file system access
 *
 * ### Bash Grants:
 * - Pattern: Command pattern (e.g., "npm:*", "git status", "*")
 * - Global: "*" pattern grants access to all bash commands
 * - Examples:
 *   - { type: "bash", pattern: "npm:*" } - All npm commands
 *   - { type: "bash", pattern: "git status" } - Specific git command
 *   - { type: "bash", pattern: "*" } - Global bash access
 *
 * ## CONFIGURATION FILE FORMAT
 *
 * .mini-kode/permissions.json:
 * {
 *   "grants": [
 *     {
 *       "type": "fs",
 *       "pattern": "/project/src",
 *       "grantedAt": "2024-01-01T12:00:00.000Z"
 *     },
 *     {
 *       "type": "bash",
 *       "pattern": "npm:*",
 *       "grantedAt": "2024-01-01T12:00:00.000Z"
 *     }
 *   ]
 * }
 */

/**
 * Save project policy to permissions file.
 *
 * @param cwd Current working directory
 * @param policy Project policy to save
 */
export function writeProjectPolicy(cwd: string, policy: ProjectPolicy): void {
  writeProjectPermissions({ grants: policy.grants }, cwd);
}

/**
 * Add a grant to the project permissions file (persistent storage).
 *
 * @param cwd Current working directory
 * @param grant Grant to add
 */
export function addProjectGrant(cwd: string, grant: FsGrant | BashGrant): void {
  updateProjectPermissions((current) => {
    // Add the new grant to existing grants
    return { grants: [...current.grants, grant] };
  }, cwd);
}

/**
 * Read project policy for permission checking.
 * This is used internally by the permission resolver.
 */
export function readProjectPolicy(cwd: string): ProjectPolicy {
  const permissions = readProjectPermissions(cwd);
  return { grants: permissions.grants };
}

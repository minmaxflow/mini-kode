import type { FsGrant, BashGrant, MCPGrant, ProjectPolicy } from "./types";
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
 * ## PERMISSION CHECK FLOW
 *
 * 1. Check approval mode (yolo/autoEdit auto-approve)
 * 2. Check session permissions (in-memory, only "once" grants)
 * 3. Check project permissions (file-based, always fresh, "remember-*" grants)
 * 4. If no grant found, prompt user for approval
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
 * - Path: File path or directory path (e.g., "/project/src", "/project/src/app.ts")
 * - Global: "*" path grants access to all files
 * - Examples:
 *   - { type: "fs", path: "/project/src/" } - Access to entire src directory
 *   - { type: "fs", path: "/project/src/app.ts" } - Access to specific file
 *   - { type: "fs", path: "*" } - Global file system access
 *
 * ### Bash Grants:
 * - Command: Command pattern (e.g., "npm:*", "git status", "*")
 * - Global: "*" command grants access to all bash commands
 * - Examples:
 *   - { type: "bash", command: "npm:*" } - All npm commands
 *   - { type: "bash", command: "git status" } - Specific git command
 *   - { type: "bash", command: "*" } - Global bash access
 *
 * ## CONFIGURATION FILE FORMAT
 *
 * .mini-kode/permissions.json:
 * {
 *   "grants": [
 *     {
 *       "type": "fs",
 *       "path": "/project/src",
 *       "grantedAt": "2024-01-01T12:00:00.000Z"
 *     },
 *     {
 *       "type": "bash",
 *       "command": "npm:*",
 *       "grantedAt": "2024-01-01T12:00:00.000Z"
 *     }
 *   ]
 * }
 */

/**
 * Add a grant to the project permissions file (persistent storage).
 *
 * @param cwd Current working directory
 * @param grant Grant to add
 */
export function addProjectGrant(
  cwd: string,
  grant: FsGrant | BashGrant | MCPGrant,
): void {
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
  return readProjectPermissions(cwd);
}

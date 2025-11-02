import type { BashGrant, FsGrant, MCPGrant, ProjectPolicy } from "./types";

/**
 * ========================================================================
 * SESSION PERMISSIONS (In-Memory Storage)
 * ========================================================================
 *
 * Core workflow for permission grants during current application session.
 * Session permissions are temporary and only exist for the current session.
 *
 * ## PERMISSION OPTIONS
 *
 * - "once": Session only (temporary, lost on restart)
 * - "remember-*": Project only (persistent, survives restart)
 *
 * ## STORAGE LOCATIONS
 *
 * - **Session**: `sessionGrants` array (in-memory, lost on restart)
 *   - Only contains "once" permissions
 * - **Persistent**: .mini-kode/permissions.json (file, survives restart)
 *   - Contains "remember-*" permissions
 *
 * ## PERMISSION CHECK
 *
 * 1. Check approval mode (yolo/autoEdit auto-approve)
 * 2. Check session permissions (in-memory, fast, only "once" grants)
 * 3. Check project permissions (file-based, always fresh, "remember-*" grants)
 * 4. If no grant found, prompt user for approval
 */

let sessionGrants: Array<FsGrant | BashGrant | MCPGrant> = [];

/**
 * Add a grant to session permissions.
 *
 * This is the unified API for adding temporary grants that exist only
 * for the current application session.
 *
 * @param grant The grant object to add to session
 *
 * @example
 * ```typescript
 * // Session grants are only for "once" permissions
 * addSessionGrant({
 *   type: "fs",
 *   path: "/project/src",
 *   grantedAt: new Date().toISOString(),
 * });
 *
 * addSessionGrant({
 *   type: "bash",
 *   command: "npm:*",
 *   grantedAt: new Date().toISOString(),
 * });
 * ```
 */
export function addSessionGrant(grant: FsGrant | BashGrant | MCPGrant): void {
  sessionGrants.push(grant);
}

export function clearSessionApprovals(): void {
  sessionGrants = [];
}

export function getSessionPolicy(): ProjectPolicy {
  return {
    grants: [...sessionGrants],
  };
}

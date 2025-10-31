import type { BashGrant, FsGrant, MCPGrant, ProjectPolicy } from "./types";

/**
 * ========================================================================
 * SESSION PERMISSIONS (In-Memory Storage)
 * ========================================================================
 *
 * Core workflow for permission grants during current application session.
 *
 * ## PERMISSION OPTIONS
 *
 * - "once": Session only
 * - "remember-prefix": Session + Persistent
 * - "remember-all": Session + Persistent
 *
 * ## STORAGE LOCATIONS
 *
 * - **Session**: `sessionGrants` array (in-memory, lost on restart)
 * - **Persistent**: .mini-kode/config.json (file, survives restart)
 *
 * ## PERMISSION CHECK
 *
 * 1. Check `sessionGrants` first (in-memory, fast)
 * 2. If no match, check .mini-kode/config.json (persistent)
 * 3. If no grant found, prompt user for approval
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
 * addSessionGrant({
 *   type: "fs",
 *   pattern: "/project/src",
 *   grantedAt: new Date().toISOString(),
 * });
 *
 * addSessionGrant({
 *   type: "bash",
 *   pattern: "npm:*",
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

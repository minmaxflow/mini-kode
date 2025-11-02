/**
 * ========================================================================
 * PERMISSION REQUEST SYSTEM
 * ========================================================================
 *
 * Handles the complete async flow for requesting user approval of tool execution.
 * This system manages the bridge between tool permission requirements and UI
 * user interaction, with support for both temporary and persistent grants.
 *
 * ## COMPLETE PERMISSION FLOW
 *
 * 1. TOOL EXECUTION → PERMISSION REQUIRED
 *    - Tool throws PermissionRequiredError with uiHint
 *    - Runner catches and converts to ToolResult with status='permission_required'
 *    - UI detects permission_required status
 *
 * 2. USER INTERACTION
 *    - UI creates approval promise and stores in pendingApprovals map
 *    - PermissionSelector component displays permission options to user
 *    - User selects option: "once" | "remember-prefix" | "remember-all" | "reject"
 *
 * 3. PERMISSION GRANTING
 *    - Promise resolves with user decision
 *    - applyPermissionGrant() processes the decision
 *    - Dual storage strategy implemented:
 *      * Session permissions (always): Fast access during current session
 *      * Persistent permissions (optional): Saved to .mini-kode/config.json
 *
 * 4. TOOL RETRY
 *    - Tool execution retries with new permissions in place
 *    - Permission checking finds newly created grants
 *    - Tool executes successfully
 *
 * ## PERMISSION GRANT STORAGE STRATEGY
 *
 * ### "once" (Temporary):
 * - Session: ✅ Added to sessionGrants array
 * - Persistent: ❌ Not saved to file
 * - Lifetime: Current session only
 *
 * ### "remember-prefix" (Persistent):
 * - Session: ✅ Added to sessionGrants array
 * - Persistent: ✅ Saved to .mini-kode/config.json
 * - Lifetime: Current session + future sessions
 *
 * ### "remember-all" (Persistent Global):
 * - Session: ✅ Added to sessionGrants array
 * - Persistent: ✅ Saved to .mini-kode/config.json
 * - Lifetime: Current session + future sessions
 */

import path from "path";
import type {
  PermissionUiHint,
  PermissionOption,
  ApprovalDecision,
} from "../permissions/types";
import { addSessionGrant, addProjectGrant } from "../permissions";
import type { MCPGrant } from "../permissions/types";
import type { FsGrant, BashGrant } from "../permissions";
import { extractCommandPrefix } from "./commandParser";

// PermissionOption and ApprovalDecision are now defined in ../permissions/types

/**
 * A pending approval request stored in the map.
 * Contains the Promise resolve/reject callbacks.
 */
export interface ApprovalPromise {
  resolve: (decision: ApprovalDecision) => void;
}

/**
 * Request user approval for a permission.
 *
 * This function creates a Promise that will be resolved when the user
 * makes a decision (approve or reject) via the UI.
 *
 * @param requestId Unique identifier for this approval request
 * @param pendingApprovals Map to store the pending promise
 * @param timeoutMs Optional timeout in milliseconds (default: 5 minutes)
 * @returns Promise that resolves with the user's decision
 *
 * @example
 * ```typescript
 * const decision = await requestUserApproval(
 *   'req-123',
 *   pendingApprovals
 * );
 *
 * if (decision.approved) {
 *   // User approved - continue execution
 * } else {
 *   // User rejected - cancel operation
 * }
 * ```
 */
export async function requestUserApproval(
  requestId: string,
  pendingApprovals: Map<string, ApprovalPromise>,
  timeoutMs: number = 5 * 60 * 1000, // 5 minutes default
): Promise<ApprovalDecision> {
  return new Promise((resolve) => {
    // Set a timeout to prevent indefinite waiting
    const timeoutId = setTimeout(() => {
      if (pendingApprovals.has(requestId)) {
        pendingApprovals.delete(requestId);
        resolve({ approved: false, reason: "timeout" });
      }
    }, timeoutMs);

    // Clean up timeout when promise resolves
    const wrappedResolve = (decision: ApprovalDecision) => {
      clearTimeout(timeoutId);
      resolve(decision);
    };

    // Store the promise callbacks for later resolution
    pendingApprovals.set(requestId, {
      resolve: wrappedResolve,
    });
  });
}

/**
 * Create an FS grant based on user approval option.
 *
 * @param uiHint The permission UI hint containing FS details
 * @param option The permission option chosen by the user
 * @returns FsGrant object or null if option is reject
 */
function createFsGrant(
  uiHint: PermissionUiHint,
  option: PermissionOption,
): FsGrant | null {
  if (option.kind === "reject" || uiHint.kind !== "fs") {
    return null;
  }

  let grantPath: string;

  if (option.kind === "once") {
    // One-time approval - grant for specific file only
    grantPath = uiHint.path;
  } else if (option.kind === "fs") {
    if (option.scope === "global") {
      // Grant all file system access (global)
      grantPath = "*";
    } else if (option.scope === "directory") {
      // Grant directory-level access
      const dirPath = path.dirname(uiHint.path);
      grantPath = dirPath + "/";
    } else {
      return null; // Unknown scope
    }
  } else {
    return null; // Wrong option kind for FS
  }

  return {
    type: "fs",
    path: grantPath,
    grantedAt: new Date().toISOString(),
  };
}

/**
 * Create a bash grant based on user approval option.
 *
 * @param uiHint The permission UI hint containing bash details
 * @param option The permission option chosen by the user
 * @returns BashGrant object or null if option is reject
 */
function createBashGrant(
  uiHint: PermissionUiHint,
  option: PermissionOption,
): BashGrant | null {
  if (option.kind === "reject" || uiHint.kind !== "bash") {
    return null;
  }

  let grantCommand: string;

  if (option.kind === "once") {
    // One-time approval - grant for this specific command
    grantCommand = uiHint.command;
  } else if (option.kind === "bash") {
    if (option.scope === "global") {
      // Grant all bash commands (global)
      grantCommand = "*";
    } else if (option.scope === "prefix") {
      // Grant command prefix (e.g., npm:*)
      const commandPrefix = extractCommandPrefix(uiHint.command);
      grantCommand = `${commandPrefix}:*`;
    } else if (option.scope === "command") {
      // Grant this specific command
      grantCommand = uiHint.command;
    } else {
      return null; // Unknown scope
    }
  } else {
    return null; // Wrong option kind for bash
  }

  return {
    type: "bash",
    command: grantCommand,
    grantedAt: new Date().toISOString(),
  };
}

/**
 * Create a MCP grant based on user approval option.
 *
 * @param uiHint The permission UI hint containing MCP details
 * @param option The permission option chosen by the user
 * @returns MCPGrant object or null if option is reject
 */
function createMCPGrant(
  uiHint: PermissionUiHint,
  option: PermissionOption,
): MCPGrant | null {
  if (option.kind === "reject" || uiHint.kind !== "mcp") {
    return null;
  }

  let serverName: string;
  let toolName: string | undefined;

  if (option.kind === "once") {
    // One-time approval - grant for specific tool only
    serverName = uiHint.serverName;
    toolName = uiHint.toolName;
  } else if (option.kind === "mcp") {
    if (option.scope === "server") {
      // Grant all tools for this specific server
      serverName = uiHint.serverName;
      toolName = undefined;
    } else if (option.scope === "tool") {
      // Grant this specific tool
      serverName = uiHint.serverName;
      toolName = uiHint.toolName;
    } else {
      return null; // Unknown scope
    }
  } else {
    return null; // Wrong option kind for MCP
  }

  return {
    type: "mcp",
    serverName,
    toolName,
    grantedAt: new Date().toISOString(),
  };
}

/**
 * Apply a permission grant based on user approval.
 *
 * This function provides clear separation between session and project
 * permission storage strategies.
 *
 * Storage Strategy:
 * - Session grants: Always added (in-memory, immediate access)
 * - Project grants: Added only for "remember-*" options (persistent storage)
 *
 * @param uiHint The permission UI hint containing grant details
 * @param option The permission option chosen by the user
 * @param cwd Current working directory (required for persistent grants)
 *
 * @example
 * ```typescript
 * // User approved with prefix option
 * await applyPermissionGrant(
 *   { kind: 'fs', mode: 'write', path: '/tmp/dir/file.txt' },
 *   'remember-prefix',
 *   '/project/working/dir'
 * );
 *
 * // Session: Grant added to memory for immediate access
 * // Project: Grant persisted to .mini-kode/config.json
 *
 * // Next call to checkFsPermission('/tmp/dir/other.txt') will succeed
 * ```
 */
export async function applyPermissionGrant(
  uiHint: PermissionUiHint,
  option: PermissionOption,
  cwd: string,
): Promise<void> {
  let grant: FsGrant | BashGrant | MCPGrant | null;

  if (uiHint.kind === "fs") {
    grant = createFsGrant(uiHint, option);
  } else if (uiHint.kind === "bash") {
    grant = createBashGrant(uiHint, option);
  } else if (uiHint.kind === "mcp") {
    grant = createMCPGrant(uiHint, option);
  } else {
    return; // Unknown uiHint kind
  }

  if (!grant) {
    return; // User rejected or invalid option
  }

  // For "once" permissions, add to session only
  // For persistent permissions, only add to project (not session)
  if (option.kind === "once") {
    addSessionGrant(grant);
  } else if (option.kind !== "reject") {
    // Persistent permissions: add to project only
    addProjectGrant(cwd, grant);
  }
}

/**
 * Resolve a pending approval request (called by UI event handler).
 *
 * @param requestId The request ID to resolve
 * @param decision The user's decision
 * @param pendingApprovals Map of pending approval requests
 * @returns true if the request was found and resolved, false otherwise
 *
 * @example
 * ```typescript
 * // User pressed [a] to approve
 * resolveApproval('req-123', { approved: true, rememberForSession: true }, pendingApprovals);
 * ```
 */
export function resolveApproval(
  requestId: string,
  decision: ApprovalDecision,
  pendingApprovals: Map<string, ApprovalPromise>,
): boolean {
  const pending = pendingApprovals.get(requestId);
  if (!pending) {
    return false;
  }
  pending.resolve(decision);
  pendingApprovals.delete(requestId);
  return true;
}

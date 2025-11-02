/**
 * Permission Types
 *
 * Core type definitions for the permission system.
 */

/**
 * Base interface for all permission grants.
 */
interface BaseGrant {
  grantedAt: string; // ISO timestamp when the grant was created
}

/**
 * File system permission grant.
 *
 * Provides access to files and directories based on path patterns.
 */
export interface FsGrant extends BaseGrant {
  type: "fs";
  path: string; // Directory path, e.g., "/project/src" (folder) or "*" (global access)
}

/**
 * Bash command permission grant.
 *
 * Provides access to execute bash commands based on command patterns.
 */
export interface BashGrant extends BaseGrant {
  type: "bash";
  command: string; // Command pattern, e.g., "npm:*" or "*" for global access
}

/**
 * MCP server/tool permission grant.
 *
 * Provides access to execute MCP tools from specific servers.
 */
export interface MCPGrant extends BaseGrant {
  type: "mcp";
  serverName: string; // MCP server name
  toolName?: string; // Specific tool name, undefined means all tools in server
}

/**
 * Union type representing any type of permission grant.
 * Uses discriminated unions for type-safe access.
 */
export type Grant = FsGrant | BashGrant | MCPGrant;

/**
 * Project policy containing persistent grants.
 */
export type ProjectPolicy = {
  grants: Array<Grant>;
};

/**
 * UI hint for permission prompts.
 * Provides contextual information to display to users when requesting permission.
 */
export type PermissionUiHint =
  | { kind: "fs"; path: string; message?: string }
  | { kind: "bash"; command: string; message?: string }
  | {
      kind: "mcp";
      serverName: string;
      toolName: string;
      displayName: string;
      message?: string;
    };

/**
 * Permission grant scope options with discriminated unions for different grant types.
 */
export type PermissionOption =
  | { kind: "once" }
  | { kind: "fs"; scope: "directory" | "global" }
  | { kind: "bash"; scope: "command" | "prefix" | "global" }
  | { kind: "mcp"; scope: "tool" | "server" }
  | { kind: "reject" };

/**
 * User's approval decision for a permission request.
 */
export type ApprovalDecision =
  | { approved: true; option: PermissionOption }
  | { approved: false; reason: "user_rejected" | "timeout" };

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
  pattern: string; // File path pattern, e.g., "/project/src" or "*" for global access
}

/**
 * Bash command permission grant.
 *
 * Provides access to execute bash commands based on command patterns.
 */
export interface BashGrant extends BaseGrant {
  type: "bash";
  pattern: string; // Command pattern, e.g., "npm:*", "git status" or "*" for global access
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

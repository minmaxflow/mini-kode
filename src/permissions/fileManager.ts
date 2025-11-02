/**
 * Permissions File Manager
 *
 * Simple file manager for project-level permissions.
 * Handles reading/writing permissions.json files without complex coordination.
 */

import fs from "fs";

import type {
  BashGrant,
  FsGrant,
  Grant,
  MCPGrant,
  ProjectPolicy,
} from "./types";
import { ProjectPaths } from "../utils/paths";

/**
 * Read project permissions from file
 *
 * Error handling strategy:
 * - File not found: Return empty permissions (expected)
 * - Parse error: Return empty permissions and log warning
 * - Permission errors: Return empty permissions and log warning
 */
export function readProjectPermissions(
  cwd: string = process.cwd(),
): ProjectPolicy {
  const filePath = ProjectPaths.getPermissionsPath(cwd);

  try {
    if (!fs.existsSync(filePath)) {
      return { grants: [] };
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    // Validate that it's an object with grants array
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.grants)
    ) {
      return { grants: [] };
    }

    // Validate grants structure for safety
    const validGrants: Grant[] = [];
    for (const grant of parsed.grants) {
      if (
        grant &&
        typeof grant === "object" &&
        typeof grant.type === "string" &&
        typeof grant.grantedAt === "string"
      ) {
        // Validate based on grant type
        if (grant.type === "fs") {
          // FS grants require path field
          if (typeof grant.path === "string") {
            validGrants.push(grant as FsGrant);
          }
        } else if (grant.type === "bash") {
          // Bash grants require command field
          if (typeof grant.command === "string") {
            validGrants.push(grant as BashGrant);
          }
        } else if (grant.type === "mcp") {
          // MCP grants require serverName field
          if (typeof grant.serverName === "string") {
            validGrants.push(grant as MCPGrant);
          }
        }
      }
    }

    return { grants: validGrants };
  } catch (error) {
    // Return empty permissions on any error
    return { grants: [] };
  }
}

/**
 * Write project permissions to file
 */
export function writeProjectPermissions(
  permissions: ProjectPolicy,
  cwd: string = process.cwd(),
): void {
  const filePath = ProjectPaths.getPermissionsPath(cwd);

  try {
    ProjectPaths.ensureDirectoryExists(filePath);
    fs.writeFileSync(filePath, JSON.stringify(permissions, null, 2), "utf8");
  } catch (error) {
    throw new Error(`Failed to write permissions to ${filePath}: ${error}`);
  }
}

/**
 * Update project permissions with a function
 */
export function updateProjectPermissions(
  updateFn: (current: ProjectPolicy) => ProjectPolicy,
  cwd: string = process.cwd(),
): void {
  const currentPermissions = readProjectPermissions(cwd);
  const updatedPermissions = updateFn(currentPermissions);
  writeProjectPermissions(updatedPermissions, cwd);
}

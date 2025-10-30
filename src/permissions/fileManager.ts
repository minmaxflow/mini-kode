/**
 * Permissions File Manager
 *
 * Simple file manager for project-level permissions.
 * Handles reading/writing permissions.json files without complex coordination.
 */

import fs from "fs";

import type { Grant, ProjectPolicy } from "./types";
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
        typeof grant.pattern === "string" &&
        typeof grant.grantedAt === "string"
      ) {
        // Only accept known grant types
        if (grant.type === "fs" || grant.type === "bash") {
          validGrants.push(grant as Grant);
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

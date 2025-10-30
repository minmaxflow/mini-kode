/**
 * Permissions System
 *
 * Centralized exports for the permission system.
 * Provides a clean, minimal API for checking and managing permissions.
 */

// Core permission checking functions
export { checkFsPermission, checkBashApproval } from "./policyResolver";
export { isPathUnderPrefix } from "./pathChecker";
export { validateBashCommand } from "./bashValidator";

// Session management
export {
  addSessionGrant,
  clearSessionApprovals,
  getSessionPolicy,
} from "./session";

// Configuration
export { addProjectGrant } from "./persistent";

// Types (re-export only what's needed externally)
export type { FsGrant, BashGrant } from "./types";

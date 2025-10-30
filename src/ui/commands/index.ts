import { clearCommand } from "./clearCommand";
import { initCommand } from "./initCommand";
import { compactCommand } from "./compactCommand";

/**
 * All available command handlers with their names
 */
export const ALL_COMMANDS = [
  clearCommand,
  initCommand,
  compactCommand,
] as const;

/**
 * Mapping of command names to command handlers
 */
export const COMMANDS_BY_NAME = {
  "/clear": clearCommand,
  "/init": initCommand,
  "/compact": compactCommand,
};

// Re-export types and executor
export type { CommandName, CommandCall, CommandHandler } from "./command.types";
export { executeCommand } from "./executor";

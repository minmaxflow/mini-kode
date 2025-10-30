/**
 * Global Configuration System
 *
 * Simplified entry point for the global-only configuration system.
 * It re-exports the key types and functions for convenient use.
 */

export type {
  ApprovalMode,
  EffectiveConfig,
  ConfigFieldPath,
  ConfigSource,
} from "./types";

export { CONFIG_FIELDS } from "./types";
export { ConfigManager } from "./manager";

/**
 * Configuration Types
 *
 * Simplified type definitions for the global-only configuration system.
 */

import type { MCPServerConfig } from "../mcp/types";

/**
 * Approval mode for operations
 */
export type ApprovalMode = "default" | "autoEdit" | "yolo";

export interface MCPConfig {
  servers: {
    [name: string]: MCPServerConfig;
  };
}

/**
 * Theme mode for the UI
 */
export type ThemeMode = "light" | "dark";

/**
 * Configuration source type
 */
export type ConfigSource = "env" | "global" | "default";

/**
 * Global configuration stored in ~/.mini-kode/config.json
 */
export interface GlobalConfig {
  /** LLM configuration */
  llm?: {
    baseURL?: string;
    model?: string;
    planModel?: string;
  };

  /** UI theme mode */
  theme?: ThemeMode;
}

/**
 * Effective configuration with source tracking
 */
export interface EffectiveConfig {
  /** LLM configuration */
  llm: {
    baseURL: string;
    model: string;
    planModel: string;
    apiKey: string;
    baseURLSource: ConfigSource;
    modelSource: ConfigSource;
    planModelSource: ConfigSource;
    apiKeySource: ConfigSource;
  };

  /** UI theme mode */
  theme: string;
  themeSource: ConfigSource;
}

/**
 * Configuration validation error
 */
export interface ConfigError {
  /** Field path with dot notation */
  field: string;
  /** Error message */
  message: string;
  /** Source of the invalid value */
  source: ConfigSource;
}

/**
 * Configuration field definitions for better type safety
 */
export const CONFIG_FIELDS = [
  "llm.baseURL",
  "llm.model",
  "llm.planModel",
  "theme",
] as const;

/**
 * Configuration field paths for type-safe operations
 */
export type ConfigFieldPath = (typeof CONFIG_FIELDS)[number];

/**
 * Configuration field values for type-safe operations
 */
export type ConfigFieldValue<T extends ConfigFieldPath> =
  T extends "llm.baseURL"
    ? string
    : T extends "llm.model"
      ? string
      : T extends "llm.planModel"
        ? string
        : T extends "theme"
          ? ThemeMode
          : never;

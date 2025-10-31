/**
 * Global Configuration Manager
 *
 * Configuration system with global-only config and 3-layer priority.
 *
 * Priority Order:
 * 1. Environment Variables (highest)
 * 2. Global Config File (~/.mini-kode/config.json)
 * 3. Defaults (lowest)
 *
 * Features:
 * - Global-only configuration (no project scope)
 * - Simple file operations without complex coordination
 * - Secure API key handling (never written to files)
 * - Configuration validation
 * - Type safety with full TypeScript support
 */

import fs from "fs";

import type {
  GlobalConfig,
  EffectiveConfig,
  ConfigError,
  ConfigFieldPath,
  ConfigFieldValue,
  ConfigSource,
  MCPConfig,
} from "./types";
import { ProjectPaths } from "../utils/paths";

/**
 * API provider presets
 */
const API_PRESETS = {
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    planModel: "deepseek-chat",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4",
    planModel: "gpt-4",
  },
} as const;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  llm: {
    baseURL: API_PRESETS.deepseek.baseURL,
    model: API_PRESETS.deepseek.model,
    planModel: API_PRESETS.deepseek.planModel,
  },
  theme: "light" as const,
};

/**
 * Load complete LLM configuration from environment variables
 *
 * Priority:
 * 1. MINIKODE_* variables (explicit user configuration)
 * 2. Provider-specific auto-detection (DEEPSEEK_API_KEY, OPENAI_API_KEY)
 *
 * Returns a complete configuration object or null if no env config available.
 */
function loadFromEnvironment(): {
  baseURL: string | undefined;
  model: string | undefined;
  planModel: string | undefined;
  apiKey: string | undefined;
} | null {
  // Check for explicit MINIKODE_* configuration first (highest priority)
  const customApiKey = process.env.MINIKODE_API_KEY;
  const customBaseURL = process.env.MINIKODE_BASE_URL;
  const customModel = process.env.MINIKODE_MODEL;
  const customPlanModel = process.env.MINIKODE_PLAN_MODEL;

  if (customApiKey && customBaseURL && customModel) {
    // Validate that custom values are not empty
    if (customApiKey.trim() && customBaseURL.trim() && customModel.trim()) {
      return {
        baseURL: customBaseURL.trim(),
        model: customModel.trim(),
        planModel: (customPlanModel || customModel).trim(),
        apiKey: customApiKey.trim(),
      };
    }
  }

  // Auto-detection based on provider API keys (lower priority)
  // Only return the API key, let resolver determine other values from defaults
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey?.trim()) {
    return {
      baseURL: undefined, // Will use default
      model: undefined, // Will use default
      planModel: undefined, // Will use default
      apiKey: deepseekKey.trim(),
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey?.trim()) {
    return {
      baseURL: undefined, // Will use default
      model: undefined, // Will use default
      planModel: undefined, // Will use default
      apiKey: openaiKey.trim(),
    };
  }

  // No environment configuration available
  return null;
}

/**
 * Read global configuration from file
 *
 * Error handling strategy:
 * - File not found: Return empty config (expected)
 * - Parse error: Return empty config and log warning
 * - Permission errors: Return empty config and log warning
 */
function readGlobalConfig(): GlobalConfig {
  const filePath = ProjectPaths.getGlobalConfigPath();

  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    // Validate that it's an object
    if (parsed === null || typeof parsed !== "object") {
      return {};
    }

    // Extract and validate known fields for safety
    const config: GlobalConfig = {};

    if (parsed.llm && typeof parsed.llm === "object") {
      config.llm = {};
      const llm = parsed.llm as any;

      if (typeof llm.baseURL === "string" && llm.baseURL.trim()) {
        config.llm.baseURL = llm.baseURL.trim();
      }
      if (typeof llm.model === "string" && llm.model.trim()) {
        config.llm.model = llm.model.trim();
      }
      if (typeof llm.planModel === "string" && llm.planModel.trim()) {
        config.llm.planModel = llm.planModel.trim();
      }
    }

    if (typeof parsed.theme === "string") {
      if (["light", "dark"].includes(parsed.theme)) {
        config.theme = parsed.theme;
      }
    }

    return config;
  } catch (error) {
    // Return empty config on any error
    return {};
  }
}

/**
 * Write configuration to global config file
 */
function writeGlobalConfig(config: GlobalConfig): void {
  const filePath = ProjectPaths.getGlobalConfigPath();

  try {
    ProjectPaths.ensureDirectoryExists(filePath);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    throw new Error(`Failed to write global config to ${filePath}: ${error}`);
  }
}

/**
 * Resolve configuration with simplified 3-layer priority
 */
function resolveWithSources<T>({
  envValue,
  globalValue,
  defaultValue,
}: {
  envValue?: T;
  globalValue?: T;
  defaultValue: T;
}): { value: T; source: ConfigSource } {
  // 1. Environment variables (highest priority)
  if (envValue !== undefined) {
    return { value: envValue, source: "env" };
  }

  // 2. Global configuration
  if (globalValue !== undefined) {
    return { value: globalValue, source: "global" };
  }

  // 3. Default values (lowest priority)
  return { value: defaultValue, source: "default" };
}

/**
 * Validate configuration and return any errors
 */
function validateConfig(config: EffectiveConfig): ConfigError[] {
  const errors: ConfigError[] = [];

  // Validate LLM configuration
  const llm = config.llm;

  if (typeof llm.baseURL !== "string" || !llm.baseURL.trim()) {
    errors.push({
      field: "llm.baseURL",
      message: "LLM base URL must be a non-empty string",
      source: llm.baseURLSource,
    });
  }

  if (typeof llm.model !== "string" || !llm.model.trim()) {
    errors.push({
      field: "llm.model",
      message: "LLM model must be a non-empty string",
      source: llm.modelSource,
    });
  }

  if (typeof llm.planModel !== "string" || !llm.planModel.trim()) {
    errors.push({
      field: "llm.planModel",
      message: "LLM plan model must be a non-empty string",
      source: llm.planModelSource,
    });
  }

  // Validate theme
  if (!["light", "dark"].includes(config.theme)) {
    errors.push({
      field: "theme",
      message: "Theme must be one of: light, dark",
      source: config.themeSource,
    });
  }

  return errors;
}

/**
 * Global configuration manager
 */
export class ConfigManager {
  /**
   * Load effective configuration from all sources
   */
  static load(): EffectiveConfig {
    // Load configuration from all sources
    const globalConfig = readGlobalConfig();
    const envConfig = loadFromEnvironment();

    // Resolve LLM configuration
    const resolvedBaseURL = resolveWithSources({
      envValue: envConfig?.baseURL,
      globalValue: globalConfig.llm?.baseURL,
      defaultValue: DEFAULT_CONFIG.llm.baseURL,
    });

    const resolvedModel = resolveWithSources({
      envValue: envConfig?.model,
      globalValue: globalConfig.llm?.model,
      defaultValue: DEFAULT_CONFIG.llm.model,
    });

    const resolvedPlanModel = resolveWithSources({
      envValue: envConfig?.planModel,
      globalValue: globalConfig.llm?.planModel,
      defaultValue: DEFAULT_CONFIG.llm.planModel,
    });

    const resolvedApiKey = resolveWithSources({
      envValue: envConfig?.apiKey,
      globalValue: undefined, // Never read API key from files
      defaultValue: "", // Empty default is allowed
    });

    // If planModel is not explicitly set, inherit from model
    let finalPlanModel = resolvedPlanModel;
    if (resolvedPlanModel.source === "default") {
      finalPlanModel = {
        value: resolvedModel.value,
        source: resolvedModel.source,
      };
    }

    // Resolve theme
    const resolvedTheme = resolveWithSources({
      envValue: undefined, // No env var for theme
      globalValue: globalConfig.theme,
      defaultValue: DEFAULT_CONFIG.theme,
    });

    const config: EffectiveConfig = {
      llm: {
        baseURL: resolvedBaseURL.value,
        model: resolvedModel.value,
        planModel: finalPlanModel.value,
        apiKey: resolvedApiKey.value,
        baseURLSource: resolvedBaseURL.source,
        modelSource: resolvedModel.source,
        planModelSource: finalPlanModel.source,
        apiKeySource: resolvedApiKey.source,
      },
      theme: resolvedTheme.value,
      themeSource: resolvedTheme.source,
    };

    // Validate configuration
    const errors = validateConfig(config);
    if (errors.length > 0) {
      const errorMessages = errors.map(
        (e) => `${e.field}: ${e.message} (${e.source})`,
      );
      throw new Error(
        `Configuration validation failed:\n${errorMessages.join("\n")}`,
      );
    }

    return config;
  }

  /**
   * Set a configuration value in global config (type-safe version with runtime validation)
   */
  static set<T extends ConfigFieldPath>(
    fieldPath: T,
    value: ConfigFieldValue<T>,
  ): void {
    // Runtime validation for critical fields
    if (fieldPath === "theme") {
      if (value !== "light" && value !== "dark") {
        throw new Error(
          `Invalid theme value: ${value}. Must be one of: light, dark`,
        );
      }
    }

    const currentConfig = readGlobalConfig();

    // Navigate to the correct nested property
    const parts = fieldPath.split(".");
    let current: any = currentConfig;

    // Navigate to parent of the field
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part];
    }

    // Set the value
    const field = parts[parts.length - 1];
    if (value === null || value === undefined) {
      delete current[field];
    } else {
      current[field] = value;
    }

    writeGlobalConfig(currentConfig);
  }

  /**
   * Get a configuration value from global config (type-safe version)
   */
  static get<T extends ConfigFieldPath>(
    fieldPath: T,
  ): ConfigFieldValue<T> | undefined {
    const config = readGlobalConfig();

    // Navigate to the field
    const parts = fieldPath.split(".");
    let current: any = config;

    for (const part of parts) {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Delete a configuration field from global config (type-safe version)
   */
  static delete(fieldPath: ConfigFieldPath): void {
    this.set(fieldPath, undefined as any);
  }

  /**
   * Read MCP configuration from project directory
   */
  static readMCPConfig(cwd: string): MCPConfig | null {
    const filePath = ProjectPaths.getProjectConfigPath(cwd, "mcp.json");

    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);

      // Basic validation
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      if (!parsed.servers || typeof parsed.servers !== "object") {
        return null;
      }

      return parsed as MCPConfig;
    } catch (error) {
      return null;
    }
  }
}

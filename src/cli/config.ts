/**
 * CLI Config Command
 *
 * Provides configuration management commands for the global-only configuration system.
 *
 * Commands:
 * - mini-kode config list [--show-sources]
 * - mini-kode config get <field>
 * - mini-kode config set <field> <value>
 * - mini-kode config delete <field>
 *
 * Examples:
 * - mini-kode config list                    # Show all effective config
 * - mini-kode config list --show-sources     # Show where values come from
 * - mini-kode config get llm.model           # Get specific value
 * - mini-kode config set llm.model gpt-4     # Set global config
 * - mini-kode config delete theme            # Remove config
 */

import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config";
import type { EffectiveConfig, ConfigFieldPath } from "../config";
import { CONFIG_FIELDS } from "../config";

/**
 * Format a configuration value for display
 */
function formatConfigValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Format configuration source for display
 */
function formatSource(source: string): string {
  const colors = {
    env: chalk.yellow,
    global: chalk.magenta,
    default: chalk.gray,
  };

  const colorFn = colors[source as keyof typeof colors] || chalk.white;
  return colorFn(source);
}

/**
 * Display effective configuration in a formatted table
 */
function displayEffectiveConfig(
  config: EffectiveConfig,
  showSources: boolean = false,
): void {
  console.log(chalk.bold("\n# Global Configuration"));

  // LLM Configuration
  console.log(chalk.bold("\n[LLM]"));
  console.log(
    `  llm.baseURL      = ${formatConfigValue(config.llm.baseURL)}${showSources ? " " + formatSource(config.llm.baseURLSource) : ""}`,
  );
  console.log(
    `  llm.model        = ${formatConfigValue(config.llm.model)}${showSources ? " " + formatSource(config.llm.modelSource) : ""}`,
  );
  console.log(
    `  llm.planModel    = ${formatConfigValue(config.llm.planModel)}${showSources ? " " + formatSource(config.llm.planModelSource) : ""}`,
  );

  // API Key (masked for security)
  const apiKey = config.llm.apiKey;
  const maskedKey = apiKey
    ? `${apiKey.slice(0, 8)}${"*".repeat(Math.max(0, apiKey.length - 8))}`
    : "(not set)";
  console.log(
    `  llm.apiKey       = ${chalk.cyan(maskedKey)}${showSources ? " " + formatSource(config.llm.apiKeySource) : ""}`,
  );

  // Theme
  console.log(chalk.bold("\n[UI]"));
  console.log(
    `  theme            = ${formatConfigValue(config.theme)}${showSources ? " " + formatSource(config.themeSource) : ""}`,
  );

  console.log(); // Empty line for readability
}

/**
 * Validate field path
 */
function validateFieldPath(fieldPath: string): fieldPath is ConfigFieldPath {
  return CONFIG_FIELDS.includes(fieldPath as ConfigFieldPath);
}

/**
 * Validate theme value
 */
function validateTheme(value: string): boolean {
  return ["light", "dark"].includes(value);
}

/**
 * Create config command
 */
export function createConfigCommand(): Command {
  const configCmd = new Command("config").description(
    "Manage global configuration settings",
  );

  // List command
  configCmd
    .command("list")
    .description("List configuration values")
    .option("--show-sources", "Show where configuration values come from")
    .action(async (options) => {
      try {
        const config = ConfigManager.load();
        displayEffectiveConfig(config, options.showSources);
      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    });

  // Get command
  configCmd
    .command("get <field>")
    .description("Get a configuration value")
    .action(async (field) => {
      try {
        if (!validateFieldPath(field)) {
          console.error(chalk.red("Error:"), `Invalid field: ${field}`);
          console.error(
            chalk.yellow("Valid fields:"),
            CONFIG_FIELDS.join(", "),
          );
          process.exit(1);
        }

        const value = ConfigManager.get(field);

        if (value === undefined || value === null) {
          console.log(chalk.gray("(not set)"));
        } else {
          console.log(formatConfigValue(value));
        }
      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    });

  // Set command
  configCmd
    .command("set <field> <value>")
    .description("Set a configuration value")
    .action(async (field, value) => {
      try {
        if (!validateFieldPath(field)) {
          console.error(chalk.red("Error:"), `Invalid field: ${field}`);
          console.error(
            chalk.yellow("Valid fields:"),
            CONFIG_FIELDS.join(", "),
          );
          process.exit(1);
        }

        // Special validation for theme
        if (field === "theme" && !validateTheme(value)) {
          console.error(chalk.red("Error:"), `Invalid theme: ${value}`);
          console.error(chalk.yellow("Valid values:"), "light, dark");
          process.exit(1);
        }

        ConfigManager.set(field, value);

        console.log(
          chalk.green(`✓ Set ${field} = ${formatConfigValue(value)} (Global)`),
        );
      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    });

  // Delete command
  configCmd
    .command("delete <field>")
    .description("Delete a configuration value")
    .action(async (field) => {
      try {
        if (!validateFieldPath(field)) {
          console.error(chalk.red("Error:"), `Invalid field: ${field}`);
          console.error(
            chalk.yellow("Valid fields:"),
            CONFIG_FIELDS.join(", "),
          );
          process.exit(1);
        }

        ConfigManager.delete(field);

        console.log(chalk.green(`✓ Deleted ${field} (Global)`));
      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    });

  return configCmd;
}

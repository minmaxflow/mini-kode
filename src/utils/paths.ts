/**
 * Path Utilities
 *
 * Centralized path management for configuration and permission files.
 */

import os from "os";
import path from "path";

/**
 * Project paths manager
 */
export class ProjectPaths {
  /** Directory name for mini-kode files */
  static readonly CONFIG_DIR = ".mini-kode";

  /** Configuration file name */
  static readonly CONFIG_FILE = "config.json";

  /** Permissions file name */
  static readonly PERMISSIONS_FILE = "permissions.json";

  /**
   * Get global configuration path
   */
  static getGlobalConfigPath(): string {
    return path.join(os.homedir(), this.CONFIG_DIR, this.CONFIG_FILE);
  }

  /**
   * Get project permissions path
   */
  static getPermissionsPath(cwd: string = process.cwd()): string {
    return path.join(cwd, this.CONFIG_DIR, this.PERMISSIONS_FILE);
  }

  /**
   * Get MCP configuration file path
   */
  static getMCPConfigPath(cwd: string = process.cwd()): string {
    return path.join(cwd, this.CONFIG_DIR, "mcp.json");
  }

  /**
   * Get project config file path (legacy method, prefer specific methods)
   */
  static getProjectConfigPath(cwd: string, fileName: string): string {
    return path.join(cwd, this.CONFIG_DIR, fileName);
  }

  /**
   * Ensure directory exists for a given file path
   */
  static ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!require("fs").existsSync(dir)) {
      require("fs").mkdirSync(dir, { recursive: true });
    }
  }
}

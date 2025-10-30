/**
 * Global Configuration Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "./manager";
import fs from "fs";
import os from "os";
import path from "path";

// Test utilities
const testConfigDir = path.join(os.tmpdir(), "mini-kode-test-config");

beforeEach(() => {
  // Set up clean test environment
  delete process.env.MINIKODE_API_KEY;
  delete process.env.MINIKODE_BASE_URL;
  delete process.env.MINIKODE_MODEL;
  delete process.env.MINIKODE_PLAN_MODEL;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;

  // Backup and override config path
  process.env.MINI_KODE_TEST_CONFIG_DIR = testConfigDir;
});

afterEach(() => {
  // Clean up test config directory
  if (fs.existsSync(testConfigDir)) {
    fs.rmSync(testConfigDir, { recursive: true, force: true });
  }
  delete process.env.MINI_KODE_TEST_CONFIG_DIR;
});

describe("ConfigManager", () => {
  describe("load", () => {
    it("should load default configuration when no config exists", () => {
      // Mock the global config path to use test directory (empty)
      const originalHomedir = os.homedir;
      os.homedir = () => testConfigDir;

      try {
        const config = ConfigManager.load();

        expect(config.llm.baseURL).toBe("https://api.deepseek.com/v1");
        expect(config.llm.model).toBe("deepseek-chat");
        expect(config.llm.planModel).toBe("deepseek-chat");
        expect(config.llm.apiKey).toBe("");
        expect(config.theme).toBe("light");

        expect(config.llm.baseURLSource).toBe("default");
        expect(config.llm.modelSource).toBe("default");
        expect(config.llm.planModelSource).toBe("default");
        expect(config.llm.apiKeySource).toBe("default");
        expect(config.themeSource).toBe("default");
      } finally {
        os.homedir = originalHomedir;
      }
    });

    it("should auto-detect DeepSeek API key", () => {
      process.env.DEEPSEEK_API_KEY = "deepseek-key";

      const config = ConfigManager.load();

      expect(config.llm.baseURL).toBe("https://api.deepseek.com/v1");
      expect(config.llm.model).toBe("deepseek-chat");
      expect(config.llm.planModel).toBe("deepseek-chat");
      expect(config.llm.apiKey).toBe("deepseek-key");

      expect(config.llm.baseURLSource).toBe("default");
      expect(config.llm.modelSource).toBe("default");
      expect(config.llm.planModelSource).toBe("default");
      expect(config.llm.apiKeySource).toBe("env");
    });
  });

  describe("set", () => {
    it("should set configuration values", () => {
      // Mock the global config path to use test directory
      const originalHomedir = os.homedir;
      os.homedir = () => testConfigDir;

      try {
        ConfigManager.set("theme", "dark");

        const themeValue = ConfigManager.get("theme");
        expect(themeValue).toBe("dark");

        // Verify the config was written to file
        const configPath = path.join(
          testConfigDir,
          ".mini-kode",
          "config.json",
        );
        expect(fs.existsSync(configPath)).toBe(true);

        const fileContent = JSON.parse(fs.readFileSync(configPath, "utf8"));
        expect(fileContent.theme).toBe("dark");
      } finally {
        os.homedir = originalHomedir;
      }
    });
  });
});

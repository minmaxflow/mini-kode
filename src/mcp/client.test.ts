/**
 * Tests for MCP Client Manager environment variable resolution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Import the functions we want to test
import { resolveEnvVars, resolveArgs, resolveHeaders } from "./client";

describe("MCP Client Environment Variable Resolution", () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.TEST_API_KEY = "test-key-123";
    process.env.TEST_URL = "https://api.example.com";
    process.env.VALID_VAR = "valid_value";
  });

  afterEach(() => {
    // Clean up test environment variables
    delete process.env.TEST_API_KEY;
    delete process.env.TEST_URL;
    delete process.env.VALID_VAR;
  });

  describe("resolveEnvVars", () => {
    it("should resolve environment variables in strings", () => {
      const input = "${TEST_URL}/api/v1";
      const result = resolveEnvVars(input);
      expect(result).toBe("https://api.example.com/api/v1");
    });

    it("should keep original text when environment variable not found", () => {
      const input = "https://${NONEXISTENT_VAR}/api";
      const result = resolveEnvVars(input);
      expect(result).toBe("https://${NONEXISTENT_VAR}/api");
    });

    it("should handle multiple environment variables", () => {
      const input = "${TEST_URL} with key ${TEST_API_KEY}";
      const result = resolveEnvVars(input);
      expect(result).toBe("https://api.example.com with key test-key-123");
    });

    it("should handle mixed resolved and unresolved variables", () => {
      const input = "${TEST_URL} and ${UNKNOWN_VAR}";
      const result = resolveEnvVars(input);
      expect(result).toBe("https://api.example.com and ${UNKNOWN_VAR}");
    });

    it("should reject invalid environment variable names", () => {
      const input = "${INVALID-VAR} ${VALID_VAR} ${123VAR}";
      const result = resolveEnvVars(input);
      expect(result).toBe("${INVALID-VAR} valid_value ${123VAR}");
    });

    it("should handle empty string", () => {
      const result = resolveEnvVars("");
      expect(result).toBe("");
    });

    it("should handle string without environment variables", () => {
      const input = "plain text without variables";
      const result = resolveEnvVars(input);
      expect(result).toBe(input);
    });
  });

  describe("resolveArgs", () => {
    it("should resolve environment variables in command line arguments", () => {
      const args = ["--api-key", "${TEST_API_KEY}", "--url", "${TEST_URL}"];
      const result = resolveArgs(args);
      expect(result).toEqual([
        "--api-key",
        "test-key-123",
        "--url",
        "https://api.example.com",
      ]);
    });

    it("should handle undefined args", () => {
      const result = resolveArgs(undefined);
      expect(result).toEqual([]);
    });

    it("should handle empty args array", () => {
      const result = resolveArgs([]);
      expect(result).toEqual([]);
    });

    it("should handle args without environment variables", () => {
      const args = ["npm", "install", "--save-dev"];
      const result = resolveArgs(args);
      expect(result).toEqual(args);
    });
  });

  describe("resolveHeaders", () => {
    it("should resolve environment variables in headers", () => {
      const headers = {
        Authorization: "Bearer ${TEST_API_KEY}",
        "X-API-Key": "${TEST_API_KEY}",
        "Content-Type": "application/json",
      };
      const result = resolveHeaders(headers);
      expect(result).toEqual({
        Authorization: "Bearer test-key-123",
        "X-API-Key": "test-key-123",
        "Content-Type": "application/json",
      });
    });

    it("should handle undefined headers", () => {
      const result = resolveHeaders(undefined);
      expect(result).toEqual({});
    });

    it("should handle empty headers object", () => {
      const result = resolveHeaders({});
      expect(result).toEqual({});
    });

    it("should handle headers without environment variables", () => {
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mini-Kode/1.0",
      };
      const result = resolveHeaders(headers);
      expect(result).toEqual(headers);
    });

    it("should handle mixed resolved and unresolved variables in headers", () => {
      const headers = {
        Authorization: "Bearer ${TEST_API_KEY}",
        "X-Unknown": "${UNKNOWN_VAR}",
      };
      const result = resolveHeaders(headers);
      expect(result).toEqual({
        Authorization: "Bearer test-key-123",
        "X-Unknown": "${UNKNOWN_VAR}",
      });
    });
  });
});

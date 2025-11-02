import { describe, it, expect } from "vitest";
import { validateBashCommand } from "./commandValidator";

describe("commandValidator", () => {
  describe("validateBashCommand", () => {
    it("should allow safe commands", () => {
      expect(validateBashCommand("echo hello").allowed).toBe(true);
      expect(validateBashCommand("ls -la").allowed).toBe(true);
      expect(validateBashCommand("npm install").allowed).toBe(true);
      expect(validateBashCommand("git status").allowed).toBe(true);
    });

    it("should allow commands with pipes", () => {
      expect(validateBashCommand("echo hi | grep h").allowed).toBe(true);
      expect(validateBashCommand("cat file.txt | head -10").allowed).toBe(true);
    });

    it("should allow commands with redirection", () => {
      expect(validateBashCommand("echo hi > /dev/null").allowed).toBe(true);
      expect(validateBashCommand("ls -la > output.txt").allowed).toBe(true);
    });

    it("should allow commands with environment variables", () => {
      expect(validateBashCommand("FOO=1 echo $FOO").allowed).toBe(true);
      expect(validateBashCommand("NODE_ENV=test npm run test").allowed).toBe(true);
    });

    it("should allow commands with subshells and logical operators", () => {
      expect(validateBashCommand("(echo ok) && echo done").allowed).toBe(true);
      expect(validateBashCommand("test -f file.txt || echo missing").allowed).toBe(true);
    });

    it("should ban network clients", () => {
      expect(validateBashCommand("curl https://x").allowed).toBe(false);
      expect(validateBashCommand("wget http://evil.com").allowed).toBe(false);
      expect(validateBashCommand("telnet localhost").allowed).toBe(false);
      expect(validateBashCommand("nc -l 8080").allowed).toBe(false);
    });

    it("should ban GUI browsers", () => {
      expect(validateBashCommand("chrome http://example.com").allowed).toBe(false);
      expect(validateBashCommand("firefox http://example.com").allowed).toBe(false);
      expect(validateBashCommand("safari http://example.com").allowed).toBe(false);
    });

    it("should ban text browsers that may hang", () => {
      expect(validateBashCommand("lynx http://example.com").allowed).toBe(false);
      expect(validateBashCommand("w3m http://example.com").allowed).toBe(false);
      expect(validateBashCommand("links http://example.com").allowed).toBe(false);
    });

    it("should ban shell state modification commands", () => {
      expect(validateBashCommand("alias ll='ls -la'").allowed).toBe(false);
    });

    it("should check ALL parts of compound commands with &&", () => {
      // Safe compound commands
      expect(validateBashCommand("cd /path && npm run test").allowed).toBe(true);
      expect(validateBashCommand("export VAR=value && ls -la").allowed).toBe(true);
      
      // Dangerous compound commands - should be banned
      expect(validateBashCommand("cd /path && curl http://evil.com").allowed).toBe(false);
      expect(validateBashCommand("curl http://evil.com && npm install").allowed).toBe(false);
    });

    it("should check ALL parts of compound commands with ||", () => {
      // Safe compound commands
      expect(validateBashCommand("test -f file.txt || echo missing").allowed).toBe(true);
      
      // Dangerous compound commands - should be banned
      expect(validateBashCommand("cd /path || telnet localhost").allowed).toBe(false);
      expect(validateBashCommand("test -f file.txt || wget http://evil.com").allowed).toBe(false);
    });

    it("should check ALL parts of compound commands with ;", () => {
      // Safe compound commands
      expect(validateBashCommand("cd /path; npm install; npm run build").allowed).toBe(true);
      
      // Dangerous compound commands - should be banned
      expect(validateBashCommand("npm install; wget http://evil.com").allowed).toBe(false);
      expect(validateBashCommand("echo start; curl http://evil.com").allowed).toBe(false);
    });

    it("should handle multiple compound operators", () => {
      // Safe compound commands
      expect(validateBashCommand("cd /path && export VAR=value && npm run test").allowed).toBe(true);
      expect(validateBashCommand("cd /path; export VAR=value; npm run build").allowed).toBe(true);
      
      // Dangerous compound commands - should be banned
      expect(validateBashCommand("cd /path && npm install && curl http://evil.com").allowed).toBe(false);
      expect(validateBashCommand("npm install; git status; wget http://evil.com").allowed).toBe(false);
    });

    it("should handle empty commands", () => {
      expect(validateBashCommand("").allowed).toBe(false);
      expect(validateBashCommand("   ").allowed).toBe(false);
    });

    it("should handle whitespace", () => {
      expect(validateBashCommand("  cd /path && npm run test  ").allowed).toBe(true);
      expect(validateBashCommand("  curl http://evil.com  ").allowed).toBe(false);
    });
  });
});
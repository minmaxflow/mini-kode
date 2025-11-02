import { describe, it, expect } from "vitest";
import { extractMainCommand, extractCommandPrefix } from "./commandParser";

describe("commandParser", () => {
  describe("extractMainCommand", () => {
    it("should extract main command from compound commands with &&", () => {
      expect(extractMainCommand("cd /path && npm run test")).toBe(
        "npm run test",
      );
      expect(extractMainCommand("cd /path && ls -la")).toBe("ls -la");
      expect(extractMainCommand("export VAR=value && npm install")).toBe(
        "npm install",
      );
    });

    it("should extract main command from compound commands with ||", () => {
      expect(extractMainCommand("cd /path || npm run build")).toBe(
        "npm run build",
      );
    });

    it("should extract main command from compound commands with ;", () => {
      expect(extractMainCommand("cd /path; npm start")).toBe("npm start");
    });

    it("should handle multiple compound operators", () => {
      expect(
        extractMainCommand("cd /path && export VAR=value && npm run test"),
      ).toBe("npm run test");
      expect(
        extractMainCommand("cd /path; export VAR=value; npm run build"),
      ).toBe("npm run build");
    });

    it("should return simple commands unchanged", () => {
      expect(extractMainCommand("ls -la")).toBe("ls -la");
      expect(extractMainCommand("npm install")).toBe("npm install");
      expect(extractMainCommand("git status")).toBe("git status");
    });

    it("should handle commands with only setup commands", () => {
      expect(extractMainCommand("cd /path")).toBe("cd /path");
      expect(extractMainCommand("export VAR=value")).toBe("export VAR=value");
      expect(extractMainCommand("cd /path && cd /other")).toBe("cd /other");
    });

    it("should trim whitespace", () => {
      expect(extractMainCommand("  cd /path && npm run test  ")).toBe(
        "npm run test",
      );
      expect(extractMainCommand("  ls -la  ")).toBe("ls -la");
    });

    it("should handle empty commands", () => {
      expect(extractMainCommand("")).toBe("");
      expect(extractMainCommand("   ")).toBe("");
    });

    it("should handle complex real-world examples", () => {
      expect(
        extractMainCommand(
          "cd /Users/minmaxflow/project/mini-kode && pnpm run lint",
        ),
      ).toBe("pnpm run lint");
      expect(
        extractMainCommand("cd /project && npm install && npm run test"),
      ).toBe("npm run test");
      expect(
        extractMainCommand("export NODE_ENV=test && npm run test:coverage"),
      ).toBe("npm run test:coverage");
    });
  });

  describe("extractCommandPrefix", () => {
    it("should extract prefix from simple commands", () => {
      expect(extractCommandPrefix("npm run test")).toBe("npm");
      expect(extractCommandPrefix("ls -la")).toBe("ls");
      expect(extractCommandPrefix("git status")).toBe("git");
    });

    it("should extract prefix from compound commands", () => {
      expect(extractCommandPrefix("cd /path && npm run test")).toBe("npm");
      expect(extractCommandPrefix("export VAR=value && pnpm install")).toBe(
        "pnpm",
      );
      expect(extractCommandPrefix("cd /path && git push")).toBe("git");
    });

    it("should extract prefix from setup commands", () => {
      expect(extractCommandPrefix("cd /path")).toBe("cd");
      expect(extractCommandPrefix("export VAR=value")).toBe("export");
    });

    it("should handle single-word commands", () => {
      expect(extractCommandPrefix("npm")).toBe("npm");
      expect(extractCommandPrefix("ls")).toBe("ls");
    });

    it("should handle empty commands", () => {
      expect(extractCommandPrefix("")).toBe("");
    });
  });
});

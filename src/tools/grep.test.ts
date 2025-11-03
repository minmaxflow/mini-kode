import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { GrepTool, searchFileContent } from "./grep";
import { createTempProject } from "../utils/testHelpers";

describe("searchFileContent", () => {
  it("should find simple pattern matches", () => {
    const content = "line 1\nline 2\nline 3\nalpha line\nbeta line";
    const regex = /alpha/;
    const filePath = "/test/file.txt";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      filePath: "/test/file.txt",
      line: "alpha line",
      lineNumber: 4,
    });
  });

  it("should find multiple matches", () => {
    const content =
      "function test() {}\nconst alpha = 1;\nfunction another() {}\nconst beta = alpha + 2;";
    const regex = /function/;
    const filePath = "/test.js";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(2);
    expect(matches[0].lineNumber).toBe(1);
    expect(matches[1].lineNumber).toBe(3);
  });

  it("should handle case insensitive patterns", () => {
    const content =
      "ERROR: something\nerror: something else\nError: another thing";
    const regex = /error/i;
    const filePath = "/test.log";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(3);
    expect(matches[0].line).toBe("ERROR: something");
    expect(matches[1].line).toBe("error: something else");
    expect(matches[2].line).toBe("Error: another thing");
  });

  it("should respect maxMatches limit", () => {
    const content = "match 1\nmatch 2\nmatch 3\nmatch 4\nmatch 5";
    const regex = /match/;
    const filePath = "/test.txt";

    const matches = searchFileContent(content, regex, filePath, 3);

    expect(matches).toHaveLength(3);
    expect(matches[0].lineNumber).toBe(1);
    expect(matches[1].lineNumber).toBe(2);
    expect(matches[2].lineNumber).toBe(3);
  });

  it("should handle complex regex patterns", () => {
    const content =
      "import React from 'react';\nimport { useState } from 'react';\nconst axios = require('axios');\nimport fs from 'fs';";
    const regex = /import\s+.*from/;
    const filePath = "/test.js";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(3);
    expect(matches[0].lineNumber).toBe(1);
    expect(matches[1].lineNumber).toBe(2);
    expect(matches[2].lineNumber).toBe(4);
  });

  it("should handle empty content", () => {
    const content = "";
    const regex = /anything/;
    const filePath = "/empty.txt";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(0);
  });

  it("should handle content with no matches", () => {
    const content = "line 1\nline 2\nline 3";
    const regex = /nomatch/;
    const filePath = "/test.txt";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(0);
  });

  it("should handle different line endings", () => {
    const content = "line 1\r\nline 2\nline 3\nline 4";
    const regex = /line \d/;
    const filePath = "/mixed.txt";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(4);
    expect(matches[0].line).toBe("line 1");
    expect(matches[1].line).toBe("line 2");
    expect(matches[2].line).toBe("line 3");
    expect(matches[3].line).toBe("line 4");
  });

  it("should handle patterns with anchors", () => {
    const content = "single line\nanother line\nfinal line";
    const regex = /single/;
    const filePath = "/test.txt";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(1);
    expect(matches[0].line).toBe("single line");
  });

  it("should handle special characters in regex", () => {
    const content =
      "console.log('test');\nconsole.error('error');\n// TODO: fix this\n// FIXME: urgent";
    const regex = /(TODO|FIXME)/;
    const filePath = "/test.js";

    const matches = searchFileContent(content, regex, filePath);

    expect(matches).toHaveLength(2);
    expect(matches[0].line).toBe("// TODO: fix this");
    expect(matches[1].line).toBe("// FIXME: urgent");
  });
});

describe("GrepTool", () => {
  it("rejects invalid regex", async () => {
    const res = await GrepTool.execute(
      { pattern: "([", path: undefined, glob: undefined },
      {
        cwd: process.cwd(),
        approvalMode: "default",
        sessionId: "test-session",
      },
    );
    if ("isError" in res) {
      expect(res.isError).toBe(true);
    } else {
      throw new Error("Expected error");
    }
  });

  it("finds matches in files and reports line numbers", async () => {
    const proj = createTempProject();
    const a = path.join(proj, "a.txt");
    const b = path.join(proj, "b.ts");
    fs.writeFileSync(a, "alpha\nbeta\nalpha", "utf8");
    fs.writeFileSync(b, "const alpha = 1;\n", "utf8");
    const res = await GrepTool.execute(
      { pattern: "alpha", path: proj, glob: "**/*.txt" },
      { cwd: proj, approvalMode: "default", sessionId: "test-session" },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.matches.length).toBe(2);
    expect(res.matches.some((m) => m.filePath === a)).toBe(true);
    expect(res.matches.some((m) => m.filePath === b)).toBe(false);
  });
});

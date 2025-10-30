import fs from "fs";
import path from "path";
import { z } from "zod";
import { globSync } from "glob";
import { Tool, GrepResult, GrepMatch } from "./types";
import { isTextFile } from "../utils/file-type";

const InputSchema = z.object({
  pattern: z
    .string()
    .describe("Regular expression pattern to search for in file contents"),
  path: z
    .string()
    .optional()
    .describe(
      "Directory path to search in (defaults to current working directory)",
    ),
  glob: z
    .string()
    .optional()
    .describe("File pattern to filter files (e.g., '*.js', '*.{ts,tsx}')"),
});

export type GrepInput = z.infer<typeof InputSchema>;

export const GREP_TOOL_PROMPT: string = `
- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+", etc.)
- Filter files by pattern with the glob parameter (eg. "*.js", "*.{ts,tsx}")
- Case insensitive search
- Returns matching file paths with line numbers, sorted by modification time
- Use this tool when you need to find files containing specific patterns
`.trim();

export const GrepTool: Tool<GrepInput, GrepResult> = {
  name: "grep",
  description: GREP_TOOL_PROMPT,
  readonly: true,
  inputSchema: InputSchema,
  async execute(input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const root = input.path
      ? path.isAbsolute(input.path)
        ? input.path
        : path.resolve(context.cwd, input.path)
      : context.cwd;

    let regex: RegExp;
    try {
      regex = new RegExp(input.pattern, "i");
    } catch {
      return { isError: true, message: "Invalid regex pattern" };
    }

    // Load .gitignore patterns
    let ignorePatterns: string[] = ["**/node_modules/**"]; // Default fallback
    try {
      const gitignorePath = path.join(root, ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
        ignorePatterns = gitignoreContent
          .split("\n")
          .map((line) => line.trim())
          .filter(
            (line) => line && !line.startsWith("#") && !line.startsWith("!"),
          )
          .map((line) => {
            // Convert gitignore patterns to glob patterns
            if (line.startsWith("/")) {
              return line.slice(1) + "/**";
            }
            if (line.endsWith("/")) {
              return line + "**";
            }
            return line;
          });
      }
    } catch (error) {
      // Use default ignore patterns if .gitignore can't be read
    }

    const matches: GrepMatch[] = [];
    let files: string[];
    try {
      files = globSync(input.glob ?? "**/*", {
        cwd: root,
        absolute: true,
        nodir: true,
        ignore: ignorePatterns,
      });
    } catch (error) {
      return {
        isError: true,
        message: `File pattern error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Sort files by modification time (newest first)
    files.sort((a, b) => {
      try {
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtimeMs - statA.mtimeMs;
      } catch {
        return 0;
      }
    });

    const maxMatches = 500;
    for (const file of files) {
      if (context.signal?.aborted)
        return { isError: true, isAborted: true, message: "Aborted" };
      if (!isTextFile(file)) continue;

      try {
        const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (context.signal?.aborted)
            return { isError: true, isAborted: true, message: "Aborted" };
          const line = lines[i];
          if (regex.test(line)) {
            matches.push({ filePath: file, line, lineNumber: i + 1 });
          }
          if (matches.length >= maxMatches) break;
        }
      } catch (error) {
        // ignore read errors for binary files etc.
        continue;
      }
      if (matches.length >= maxMatches) break;
    }

    return {
      type: "grep",
      matches,
      pattern: input.pattern,
      glob: input.glob,
      path: root,
    };
  },
};

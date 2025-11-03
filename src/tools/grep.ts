import fs from "fs";
import path from "path";
import { z } from "zod";
import { globSync } from "glob";
import { Tool, GrepResult, GrepMatch } from "./types";
import { isTextFile } from "../utils/file-type";

/**
 * Search for regex patterns in file content line by line
 * @param content - File content to search through
 * @param regex - Regular expression pattern to match
 * @param filePath - Path to the file (for result context)
 * @param maxMatches - Maximum number of matches to return
 * @returns Array of line matches with line numbers
 */
export function searchFileContent(
  content: string,
  regex: RegExp,
  filePath: string,
  maxMatches: number = 500,
): GrepMatch[] {
  const matches: GrepMatch[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (regex.test(line)) {
      matches.push({ filePath, line, lineNumber: i + 1 });
    }
    if (matches.length >= maxMatches) break;
  }

  return matches;
}

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

## Pattern Examples (Regex):
- "function\\s+\\w+" - Find function definitions
- "import.*from" - Find import statements
- "console\\.(log|error)" - Find console log/error calls
- "TODO|FIXME" - Find TODO or FIXME comments
- "class\\s+\\w+" - Find class definitions

## Glob Parameter Examples:
- "*.ts" - Search only in TypeScript files in current directory
- "**/*.js" - Search in JavaScript files in current directory and subdirectories
- "src/**/*.ts" - Search in TypeScript files within src directory and subdirectories
- "test/**/*.test.ts" - Search only in test files
- "*.{js,ts}" - Search in JavaScript and TypeScript files in current directory
- "package.json" - Search only in specific file

## Path and Glob Usage:
- path: Directory to search in (defaults to current working directory)
- glob: File pattern to filter which files to search within
- When both path and glob are used: searches within the specified path for files matching the glob pattern
- When only glob is provided: searches from current working directory for files matching the pattern
- When neither is provided: searches all files in current working directory

## Important Notes:
- Search is case insensitive by default
- Avoid overly broad patterns like ".*" which may match too many files
- Use specific glob patterns to limit search scope for better performance
- For finding files by name, use the glob tool instead
`.trim();

export const GrepTool: Tool<GrepInput, GrepResult> = {
  name: "grep",
  displayName: "Search",
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

    const matches: GrepMatch[] = [];
    let files: string[];
    try {
      files = globSync(input.glob ?? "**/*", {
        cwd: root,
        absolute: true,
        nodir: true,
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
        const content = fs.readFileSync(file, "utf8");
        const fileMatches = searchFileContent(
          content,
          regex,
          file,
          maxMatches - matches.length,
        );
        matches.push(...fileMatches);
      } catch (error) {
        // ignore read errors for binary files etc.
        continue;
      }
      if (matches.length >= maxMatches) break;
    }

    const result: GrepResult = {
      matches,
      pattern: input.pattern,
      glob: input.glob,
      path: root,
    };
    return result;
  },
};

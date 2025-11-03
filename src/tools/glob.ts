import fs from "fs";
import path from "path";
import { z } from "zod";
import { globSync } from "glob";
import { Tool, GlobResult } from "./types";

const InputSchema = z.object({
  pattern: z
    .string()
    .describe(
      "The glob pattern to match files (e.g., '**/*.js', 'src/**/*.ts')",
    ),
  path: z
    .string()
    .optional()
    .describe(
      "The directory to search in (defaults to current working directory)",
    ),
});

export type GlobInput = z.infer<typeof InputSchema>;

export const GLOB_TOOL_PROMPT: string = `
- Fast file pattern matching using the glob library.
- Supports standard glob patterns for finding files by name.

## Pattern Examples:
- "*.ts" - All TypeScript files in current directory
- "**/*.js" - All JavaScript files in current directory and subdirectories
- "src/**/*.ts" - All TypeScript files in src directory and subdirectories
- "test/**/*.test.ts" - All test files in test directory and subdirectories
- "*.{js,ts}" - All JavaScript and TypeScript files in current directory
- "package.json" - Find specific file

## Path Usage:
- If path is provided, searches within that directory (relative to current working directory)
- If path is omitted, searches from current working directory
- Path should be absolute or relative to the current working directory

## Important Notes:
- Returns matching file paths sorted by modification time (newest first)
- Always use this tool when you need to find files by name patterns
- For searching file contents, use the grep tool instead
- The pattern follows standard glob syntax, not regex
`.trim();

export const GlobTool: Tool<GlobInput, GlobResult> = {
  name: "glob",
  displayName: "Search",
  description: GLOB_TOOL_PROMPT,
  readonly: true,
  inputSchema: InputSchema,
  async execute(input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const root = input.path
      ? path.resolve(context.cwd, input.path)
      : context.cwd;

    const matchedFiles = globSync(input.pattern, {
      cwd: root,
      absolute: true,
      nodir: true,
    });

    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };

    const maxFiles = 500;
    const limitedFiles = matchedFiles.slice(0, maxFiles);

    const filesWithStats = limitedFiles.map((p: string) => ({
      path: p,
      mtimeMs: fs.statSync(p).mtimeMs,
    }));

    filesWithStats.sort(
      (a: { mtimeMs: number }, b: { mtimeMs: number }) => b.mtimeMs - a.mtimeMs,
    );

    const files = filesWithStats.map((f: { path: string }) => f.path);

    const result: GlobResult = {
      pattern: input.pattern,
      path: root,
      files,
    };

    return result;
  },
};

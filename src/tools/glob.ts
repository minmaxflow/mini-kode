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
- Supports standard glob patterns like "**/*.js", "src/**/*.ts", etc.
- Returns matching file paths sorted by modification time.
- Use this tool when you need to find files by name patterns.
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

    const filesWithStats = matchedFiles.map((p: string) => ({
      path: p,
      mtimeMs: fs.statSync(p).mtimeMs,
    }));

    filesWithStats.sort(
      (a: { mtimeMs: number }, b: { mtimeMs: number }) => b.mtimeMs - a.mtimeMs,
    );

    const files = filesWithStats.map((f: { path: string }) => f.path);

    return { type: "glob", pattern: input.pattern, path: root, files };
  },
};

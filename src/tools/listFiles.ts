import fs from "fs";
import path from "path";
import { z } from "zod";
import { Tool, ListFilesResult } from "./types";

const InputSchema = z.object({
  path: z.string().describe("The absolute path to the directory to list"),
});

export type ListFilesInput = z.infer<typeof InputSchema>;

export const LISTFILES_TOOL_PROMPT: string = `
Lists files and directories in a given path. 

The path parameter must be an absolute path, not a relative path. 
Prefer this over using bash ls. You should generally prefer the Glob and Grep tools, if you know which directories to search. 
Return entries with name and kind, and a total count.
`.trim();

export const ListFilesTool: Tool<ListFilesInput, ListFilesResult> = {
  name: "listFiles",
  displayName: "List",
  description: LISTFILES_TOOL_PROMPT,
  readonly: true,
  inputSchema: InputSchema,
  async execute(input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const abs = path.isAbsolute(input.path)
      ? input.path
      : path.resolve(context.cwd, input.path);
    try {
      if (!fs.existsSync(abs))
        return { isError: true, message: "Path not found" };
      const stat = fs.statSync(abs);
      if (!stat.isDirectory())
        return { isError: true, message: "Path is not a directory" };
      if (context.signal?.aborted)
        return { isError: true, isAborted: true, message: "Aborted" };
      const names = fs.readdirSync(abs);

      if (context.signal?.aborted)
        return { isError: true, isAborted: true, message: "Aborted" };

      const entries = names.map((name) => {
        const p = path.join(abs, name);
        const s = fs.statSync(p);
        const kind: "file" | "dir" = s.isDirectory() ? "dir" : "file";
        return { name, kind };
      });
      return { type: "listFiles", path: abs, entries, total: entries.length };
    } catch (err) {
      return { isError: true, message: "Failed to list directory" };
    }
  },
};

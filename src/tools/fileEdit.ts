import crypto from "crypto";
import fs from "fs";
import path from "path";
import { z } from "zod";

import { Tool, FileEditResult, PermissionRequiredError } from "./types";
import { checkFsPermission } from "../permissions";

export type MatchResult = "none" | "one" | "more";

/**
 * Check how many times a substring appears in the content
 * @param content - The content to search in
 * @param substring - The substring to search for
 * @returns "none" if not found, "one" if found once, "more" if found multiple times
 */
export function checkStringMatch(
  content: string,
  substring: string,
): MatchResult {
  if (substring === "") {
    // Empty string matches at every position, but we treat this as a special case
    return content.length === 0 ? "none" : "more";
  }

  const firstIndex = content.indexOf(substring);
  if (firstIndex === -1) {
    return "none";
  }

  const secondIndex = content.indexOf(substring, firstIndex + 1);
  return secondIndex === -1 ? "one" : "more";
}

const InputSchema = z.object({
  filePath: z.string().describe("The absolute path to the file to modify"),
  old_string: z
    .string()
    .describe("The text to replace (must be unique within the file)"),
  new_string: z.string().describe("The edited text to replace the old_string"),
});

export type FileEditInput = z.infer<typeof InputSchema>;

type CacheEntry = { contentHash: string };
const readCache: Map<string, CacheEntry> = new Map();

export function noteFileReadForEdit(filePath: string, content: string) {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  readCache.set(path.resolve(filePath), { contentHash: hash });
}

function getCacheEntry(filePath: string): CacheEntry | undefined {
  return readCache.get(path.resolve(filePath));
}

export const FILEEDIT_TOOL_PROMPT: string = `
This is a tool for editing files. For moving or renaming files, you should generally use the Bash tool with the 'mv' command instead.

Before using this tool:

1. CRITICAL REQUIREMENT: You MUST use the fileRead tool to read the file FIRST before attempting any edits. This is strictly enforced by the system - edits will fail if the file hasn't been read first.

2. Verify the directory path is correct (only applicable when creating new files):
   - Use the LS tool to verify the parent directory exists and is the correct location

To make a file edit, provide the following:
1. file_path: The absolute path to the file to modify (must be absolute, not relative)
2. old_string: The text to replace (must be unique within the file, and must match the file contents exactly, including all whitespace and indentation)
3. new_string: The edited text to replace the old_string

The tool will replace ONE occurrence of old_string with new_string in the specified file.

CRITICAL REQUIREMENTS FOR USING THIS TOOL:

1. UNIQUENESS: The old_string MUST uniquely identify the specific instance you want to change. This means:
   - Include AT LEAST 3-5 lines of context BEFORE the change point
   - Include AT LEAST 3-5 lines of context AFTER the change point
   - Include all whitespace, indentation, and surrounding code exactly as it appears in the file

2. SINGLE INSTANCE: This tool can only change ONE instance at a time. If you need to change multiple instances:
   - Make separate calls to this tool for each instance
   - Each call must uniquely identify its specific instance using extensive context

3. VERIFICATION: Before using this tool:
   - Check how many instances of the target text exist in the file
   - If multiple instances exist, gather enough context to uniquely identify each one
   - Plan separate tool calls for each instance

WARNING: If you do not follow these requirements:
   - The tool will fail if the file hasn't been read first using fileRead (STRICTLY ENFORCED)
   - The tool will fail if old_string matches multiple locations
   - The tool will fail if old_string doesn't match exactly (including whitespace)
   - You may change the wrong instance if you don't include enough context

When making edits:
   - Ensure the edit results in idiomatic, correct code
   - Do not leave the code in a broken state
   - Always use absolute file paths (starting with /)

If you want to create a new file, use:
   - A new file path, including dir name if needed
   - An empty old_string
   - The new file's contents as new_string

Remember: when making multiple file edits in a row to the same file, you should prefer to send all edits in a single message with multiple calls to this tool, rather than multiple messages with a single call each.
`.trim();

export const FileEditTool: Tool<FileEditInput, FileEditResult> = {
  name: "fileEdit",
  displayName: "Update",
  description: FILEEDIT_TOOL_PROMPT,
  readonly: false,
  inputSchema: InputSchema,
  async execute(input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const abs = path.isAbsolute(input.filePath)
      ? input.filePath
      : path.resolve(context.cwd, input.filePath);

    const perm = checkFsPermission(context.cwd, abs, context.approvalMode);
    if (!perm.ok)
      throw new PermissionRequiredError({
        kind: "fs",
        path: abs,
        message: perm.message,
      });

    const exists = fs.existsSync(abs);
    if (!exists && input.old_string !== "") {
      return {
        isError: true,
        message: "File not found",
        reason: "not_found",
      };
    }

    if (!exists && input.old_string === "") {
      const dir = path.dirname(abs);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(abs, input.new_string, "utf8");
      return {
        filePath: abs,
        mode: "create",
        success: true,
        oldContent: "",
        newContent: input.new_string,
        editStartLine: 1,
      };
    }

    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const before = fs.readFileSync(abs, "utf8");
    const currentHash = crypto
      .createHash("sha256")
      .update(before)
      .digest("hex");
    const cache = getCacheEntry(abs);
    if (!cache || cache.contentHash !== currentHash) {
      return {
        isError: true,
        message: "Please read the file first to confirm context.",
      };
    }

    const matchResult = checkStringMatch(before, input.old_string);
    if (matchResult === "none") {
      return {
        isError: true,
        message: "old_string not found",
      };
    }
    if (matchResult === "more")
      return {
        isError: true,
        message: "old_string is not unique",
      };

    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };

    // Calculate the starting line number of the edit
    const editStartLine = calculateStartLineNumber(before, input.old_string);

    const after = before.replace(input.old_string, input.new_string);
    fs.writeFileSync(abs, after, "utf8");

    // Update cache to reflect the new file content
    noteFileReadForEdit(abs, after);

    return {
      filePath: abs,
      mode: "update",
      success: true,
      oldContent: input.old_string,
      newContent: input.new_string,
      editStartLine,
    };
  },
};

/**
 * Calculates the starting line number of the given text in the file content.
 * @param content - The full file content
 * @param searchText - The text to find in the content
 * @returns The 1-based line number where the text starts, defaults to 1 if not found
 */
export function calculateStartLineNumber(
  content: string,
  searchText: string,
): number {
  const lines = content.split("\n");
  const searchLines = searchText.split("\n");

  for (let i = 0; i <= lines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (lines[i + j] !== searchLines[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i + 1; // Return 1-based line number
    }
  }

  return 1; // Default to line 1 if not found
}

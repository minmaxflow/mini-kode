import fs from "fs";
import path from "path";
import { z } from "zod";

import { isPathUnderPrefix } from "../permissions";
import { Tool, FileReadResult, ToolExecutionContext } from "./types";
import { noteFileReadForEdit } from "./fileEdit";
import { limitText } from "./limitUtils";
import { isTextFile } from "../utils/file-type";

const InputSchema = z.object({
  filePath: z.string().describe("The absolute path to the file to read"),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("The line number to start reading from (0-based)"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The maximum number of lines to read"),
});

export type FileReadInput = z.infer<typeof InputSchema>;

export const FILEREAD_TOOL_PROMPT: string = `
Reads a file from the local filesystem. 

The file_path parameter must be an absolute path, not a relative path. 
By default, it reads up to 2000 lines starting from the beginning of the file. 

You can optionally specify a line offset and limit (especially handy for long files), 
but it's recommended to read the whole file by not providing these parameters. 
Any lines longer than 2000 characters will be truncated.
`.trim();

export const FileReadTool: Tool<FileReadInput, FileReadResult> = {
  name: "fileRead",
  displayName: "Read",
  description: FILEREAD_TOOL_PROMPT,
  readonly: true,
  inputSchema: InputSchema,
  async execute(
    input: FileReadInput,
    context: ToolExecutionContext,
  ): Promise<FileReadResult> {
    if (context.signal?.aborted)
      return {
        isError: true,
        isAborted: true,
        message: "Aborted",
        filePath: input.filePath,
      };
    const { filePath, offset, limit } = input;
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(context.cwd, filePath);

    try {
      if (!fs.existsSync(absolute))
        return { isError: true, message: "File not found", filePath: absolute };
      const stat = fs.statSync(absolute);
      if (!stat.isFile())
        return {
          isError: true,
          message: "Path is not a file",
          filePath: absolute,
        };

      // Security note: As a readonly tool, fileRead does not require permission approval.
      // However, we check if reading files outside the project directory
      // to help users be aware of potential security implications.
      if (!isPathUnderPrefix(absolute, context.cwd)) {
        // File is outside project directory - continue reading but note security consideration
      }

      if (context.signal?.aborted)
        return {
          isError: true,
          isAborted: true,
          message: "Aborted",
          filePath: absolute,
        };
      // Validate that file is a text file
      if (!isTextFile(absolute)) {
        return {
          isError: true,
          message: "File contains binary or non-text content and cannot be read as text",
          filePath: absolute,
        };
      }

      const raw = fs.readFileSync(absolute, "utf8");

      // Record read to enable safe read-before-write flow for FileEditTool
      noteFileReadForEdit(absolute, raw);

      // Apply text limits using shared utility with offset support
      const maxLinesToRead = limit ? Math.min(limit, 2000) : 2000;
      const { content, fileTotalLines, actualOffset, actualLimit } = limitText(
        raw,
        {
          offset: offset ?? 0,
          maxLines: maxLinesToRead,
        },
      );

      if (context.signal?.aborted)
        return {
          isError: true,
          isAborted: true,
          message: "Aborted",
          filePath: absolute,
        };

      const result: FileReadResult = {
        filePath: absolute,
        content,
        offset: actualOffset,
        limit: actualLimit,
        fileTotalLines,
      };

      return result;
    } catch (err) {
      return {
        isError: true,
        message: "Failed to read file",
        filePath: absolute,
      };
    }
  },
};

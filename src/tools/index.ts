export * from "./types";
export * from "./fileRead";
export * from "./listFiles";
export * from "./grep";
export * from "./glob";
export * from "./fileEdit";
export * from "./bash";
export * from "./architect";
export * from "./todo";
export * from "./runner";
export * from "./openai";

import { FileReadTool } from "./fileRead";
import { ListFilesTool } from "./listFiles";
import { GrepTool } from "./grep";
import { GlobTool } from "./glob";
import { FileEditTool } from "./fileEdit";
import { BashTool } from "./bash";
import { ArchitectTool } from "./architect";
import { TodoReadTool, TodoWriteTool } from "./todo";

/**
 * Registry of all available tools
 *
 * Contains all tools defined in the system, used for:
 * 1. Passing to LLM API (converted to OpenAI format)
 * 2. Tool lookup (finding tool instances by name)
 * 3. Tool list display
 */
export const ALL_TOOLS = [
  FileReadTool,
  ListFilesTool,
  GrepTool,
  GlobTool,
  FileEditTool,
  BashTool,
  ArchitectTool,
  TodoReadTool,
  TodoWriteTool,
] as const;

/**
 * Mapping of tool names to tool instances
 *
 * Used for quickly finding corresponding tool instances by tool names returned by LLM
 */
export const TOOLS_BY_NAME = {
  fileRead: FileReadTool,
  listFiles: ListFilesTool,
  grep: GrepTool,
  glob: GlobTool,
  fileEdit: FileEditTool,
  bash: BashTool,
  architect: ArchitectTool,
  todo_read: TodoReadTool,
  todo_write: TodoWriteTool,
} as const;

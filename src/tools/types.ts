import { z } from "zod";

import type { ApprovalMode } from "../config";

export type ReadonlyFlag = true | false;

export type PermissionUiHint =
  | { kind: "fs"; path: string; message?: string }
  | { kind: "bash"; command: string; message?: string };

/**
 * Permission required error thrown when a tool needs user approval.
 *
 * This error is caught by the Tool Runner and converted to a
 * `permission_required` status, which triggers the UI to show
 * a permission prompt to the user.
 */
export class PermissionRequiredError extends Error {
  public readonly uiHint: PermissionUiHint;

  constructor(uiHint: PermissionUiHint) {
    super(uiHint.message ?? "Permission required");
    this.name = "PermissionRequiredError";
    this.uiHint = uiHint;
  }
}

/**
 * Base type for tool execution errors.
 * All tool errors should include isError: true to indicate failure.
 *
 * For abort scenarios, include isAborted: true to distinguish from normal errors.
 */
export type ToolErrorResult =
  | { isError: true; isAborted?: false; message: string }
  | { isError: true; isAborted: true; message: string };

export interface ToolExecutionContext {
  cwd: string;
  signal?: AbortSignal;
  /**
   * Resolved approval mode for this session.
   *
   * This combines any CLI override with configuration to provide the final
   * approval mode that should be used for tool execution.
   */
  approvalMode: ApprovalMode;
  /**
   * Session ID for runtime isolation and resource management
   */
  sessionId: string;
}

export interface Tool<Input, Output> {
  name: string;
  description: string;
  readonly: ReadonlyFlag;
  inputSchema: z.ZodType<Input>;
  /**
   * Execute the tool with the given input and context.
   *
   * ## Abort Controller Handling
   *
   * Tools should respect the abort signal to allow users to cancel long-running operations:
   *
   * ### Required Check Points:
   * 1. **Entry point**: Check immediately after function entry
   * 2. **Before expensive operations**: Before file I/O, network requests, or heavy computation
   * 3. **Inside loops**: Check periodically in long-running loops
   * 4. **Async operation boundaries**: Before and after await calls
   *
   * ### Abort Response Format:
   * ```typescript
   * // For user-initiated aborts
   * if (context.signal?.aborted) {
   *   return { isError: true, isAborted: true, message: "Aborted" };
   * }
   *
   * // For regular errors
   * return { isError: true, message: "Something went wrong" };
   * ```
   *
   * ### Example Pattern:
   * ```typescript
   * async execute(input, context) {
   *   // 1. Entry point check
   *   if (context.signal?.aborted) return { isError: true, isAborted: true, message: "Aborted" };
   *
   *   // 2. Before expensive operation
   *   if (context.signal?.aborted) return { isError: true, isAborted: true, message: "Aborted" };
   *   const data = await expensiveOperation();
   *
   *   // 3. Inside loops
   *   for (const item of items) {
   *     if (context.signal?.aborted) return { isError: true, isAborted: true, message: "Aborted" };
   *     // process item
   *   }
   *
   *   return successResult;
   * }
   * ```
   *
   * @param input - Tool input parameters
   * @param context - Execution context including abort signal
   * @returns Tool result or error/abort result
   */
  execute(input: Input, context: ToolExecutionContext): Promise<Output>;
}

export type BashResult =
  | {
      type: "bash";
      command: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      truncated: boolean;
      durationMs: number;
    }
  | ToolErrorResult;

export type FileReadResult =
  | {
      type: "fileRead";
      filePath: string;
      content: string;
      offset: number;
      limit: number;
      totalLines: number;
      truncated: boolean;
    }
  | (ToolErrorResult & { filePath: string });

export type ListFilesEntry = { name: string; kind: "file" | "dir" };

export type ListFilesResult =
  | {
      type: "listFiles";
      path: string;
      entries: ListFilesEntry[];
      total: number;
    }
  | ToolErrorResult;

export type GrepMatch = { filePath: string; line: string; lineNumber: number };

export type GrepResult =
  | {
      type: "grep";
      matches: GrepMatch[];
      pattern: string;
      include?: string;
      path?: string;
    }
  | ToolErrorResult;

export type GlobResult =
  | {
      type: "glob";
      pattern: string;
      path?: string;
      files: string[];
    }
  | ToolErrorResult;

export type FileEditSuccessType = {
  type: "fileEdit";
  filePath: string;
  mode: "create" | "update";
  success: true;
  message: string;
  oldContent?: string;
  newContent: string;
  editStartLine: number;
};

export type FileEditFailure = ToolErrorResult & {
  reason?:
    | "non_unique"
    | "not_found"
    | "permission"
    | "read_before_write_missing";
};

export type FileEditResult = FileEditSuccessType | FileEditFailure;

export type ArchitectResult =
  | {
      type: "architect";
      plan: string;
    }
  | ToolErrorResult;

export type TodoItem = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high";
  description?: string;
};

export type TodoResult =
  | {
      type: "todo_read" | "todo_write";
      todos: TodoItem[];
    }
  | ToolErrorResult;

/**
 * Helper types for success results only
 * These exclude error states and are used in UI components that only handle success cases
 */
export type FileReadSuccess = Extract<FileReadResult, { type: "fileRead" }>;
export type ListFilesSuccess = Extract<ListFilesResult, { type: "listFiles" }>;
export type GrepSuccess = Extract<GrepResult, { type: "grep" }>;
export type GlobSuccess = Extract<GlobResult, { type: "glob" }>;
export type ArchitectSuccess = Extract<ArchitectResult, { type: "architect" }>;
export type TodoSuccess = Extract<
  TodoResult,
  { type: "todo_read" | "todo_write" }
>;
export type FileEditSuccess = FileEditSuccessType;
export type BashSuccess = Extract<BashResult, { type: "bash" }>;

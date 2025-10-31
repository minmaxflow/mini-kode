/**
 * Tool Result Views Index
 *
 * Maps tool names to their respective result view components.
 */

import path from "path";

import React from "react";

import { getToolsByName } from "../../../tools";
import type { BashInput } from "../../../tools/bash";
import type { FileEditInput } from "../../../tools/fileEdit";
import type { FileReadInput } from "../../../tools/fileRead";
import type { GlobInput } from "../../../tools/glob";
import type { GrepInput } from "../../../tools/grep";
import type { ListFilesInput } from "../../../tools/listFiles";
import type {
  ArchitectSuccess,
  BashSuccess,
  FileEditSuccess,
  FileReadSuccess,
  GlobSuccess,
  GrepSuccess,
  ListFilesSuccess,
  TodoSuccess,
} from "../../../tools/types";
import type { ToolCall, ToolName } from "../../../tools/runner.types";
import { ArchitectResultView } from "./ArchitectResultView";
import { BashResultView } from "./BashResultView";
import { FileEditResultView } from "./FileEditResultView";
import { FileReadResultView } from "./FileReadResultView";
import { GlobResultView } from "./GlobResultView";
import { GrepResultView } from "./GrepResultView";
import { ListFilesResultView } from "./ListFilesResultView";
import { TodoResultView } from "./TodoResultView";

/**
 * Generate a descriptive title for a tool call based on its input.
 *
 * @param toolCall Complete tool call object containing name, input, and metadata
 * @param cwd Current working directory for relative path display
 * @returns Object containing toolName and toolInput for separate rendering
 */
export function getToolCallTitle(
  toolCall: ToolCall,
  cwd: string,
): {
  toolName: string;
  toolInput: string;
} {
  const { toolName, input } = toolCall;

  switch (toolName) {
    case "bash":
      return {
        toolName: "Bash",
        toolInput: (input as BashInput).command || "",
      };
    case "fileRead": {
      // Use relative path if filePath is absolute
      const filePath = (input as FileReadInput).filePath || "";
      const displayPath = path.isAbsolute(filePath)
        ? path.relative(cwd, filePath)
        : filePath;
      return {
        toolName: "Read",
        toolInput: displayPath,
      };
    }
    case "fileEdit": {
      // Use relative path if filePath is absolute
      const filePath = (input as FileEditInput).filePath || "";
      const displayPath = path.isAbsolute(filePath)
        ? path.relative(cwd, filePath)
        : filePath;
      return {
        toolName:
          (input as FileEditInput).old_string === "" ? "Create" : "Update",
        toolInput: displayPath,
      };
    }
    case "listFiles": {
      // Use relative path if path is absolute
      const dirPath = (input as ListFilesInput).path || ".";
      const displayPath = path.isAbsolute(dirPath)
        ? path.relative(cwd, dirPath)
        : dirPath;
      return {
        toolName: "List",
        toolInput: displayPath,
      };
    }
    case "grep": {
      const grepInput = input as GrepInput;
      const params = [`pattern: "${grepInput.pattern || ""}"`];
      if (grepInput.glob) params.push(`glob: "${grepInput.glob}"`);
      if (grepInput.path) params.push(`path: "${grepInput.path}"`);
      return {
        toolName: "Search",
        toolInput: params.join(", "),
      };
    }
    case "glob": {
      const globInput = input as GlobInput;
      const params = [`pattern: "${globInput.pattern || ""}"`];
      if (globInput.path) params.push(`path: "${globInput.path}"`);
      return {
        toolName: "Search",
        toolInput: params.join(", "),
      };
    }
    case "architect":
      return {
        toolName: "Plan",
        toolInput: "",
      };
    case "todo_read":
      return {
        toolName: "Read Todos",
        toolInput: "",
      };
    case "todo_write":
      return {
        toolName: "Update Todos",
        toolInput: "",
      };
  }
}

/**
 * Get the appropriate result view component for a tool.
 *
 * @param toolName Name of the tool
 * @returns Render function for the tool's result, or undefined if no custom view
 */
export function getToolResultView(
  toolName: ToolName,
  cwd: string,
): ((toolCall: ToolCall, cwd: string) => React.ReactNode) | undefined {
  switch (toolName) {
    case "bash":
      return (toolCall) =>
        React.createElement(BashResultView, {
          result: toolCall.result as BashSuccess,
        });
    case "fileRead":
      return (toolCall) =>
        React.createElement(FileReadResultView, {
          result: toolCall.result as FileReadSuccess,
        });
    case "fileEdit":
      return (toolCall) =>
        React.createElement(FileEditResultView, {
          result: toolCall.result as FileEditSuccess,
          cwd,
        });
    case "listFiles":
      return (toolCall) =>
        React.createElement(ListFilesResultView, {
          result: toolCall.result as ListFilesSuccess,
        });
    case "grep":
      return (toolCall) =>
        React.createElement(GrepResultView, {
          result: toolCall.result as GrepSuccess,
        });
    case "glob":
      return (toolCall) =>
        React.createElement(GlobResultView, {
          result: toolCall.result as GlobSuccess,
        });
    case "architect":
      return (toolCall) =>
        React.createElement(ArchitectResultView, {
          result: toolCall.result as ArchitectSuccess,
        });
    case "todo_read":
    case "todo_write":
      return (toolCall) =>
        React.createElement(TodoResultView, {
          result: toolCall.result as TodoSuccess,
        });
    default:
      return undefined;
  }
}

/**
 * Check if a tool is readonly
 *
 * @param toolName Name of the tool
 * @returns true if the tool is readonly, false otherwise
 */
export function isToolReadonly(toolName: ToolName): boolean {
  const toolsByName = getToolsByName();
  const tool = toolsByName[toolName];
  return tool ? tool.readonly : false;
}

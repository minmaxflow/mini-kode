/**
 * Tool Result Views Index
 *
 * Maps tool names to their respective result view components.
 */

import path from "path";

import React from "react";

import { getToolsByName } from "../../../tools";
import { isPathUnderPrefix } from "../../../permissions";
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
import type { ToolCall } from "../../../tools/runner.types";
import { ArchitectResultView } from "./ArchitectResultView";
import { BashResultView } from "./BashResultView";
import { FileEditResultView } from "./FileEditResultView";
import { FileReadResultView } from "./FileReadResultView";
import { GlobResultView } from "./GlobResultView";
import { GrepResultView } from "./GrepResultView";
import { ListFilesResultView } from "./ListFilesResultView";
import { TodoResultView } from "./TodoResultView";
import { MCPResultView } from "./MCPResultView";

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

  // Get display name from tool definition
  const toolsByName = getToolsByName();
  const tool = toolsByName[toolName];
  const displayToolName = tool?.displayName || toolName;

  // Special handling for file paths to show relative paths
  let toolInput = "";

  if (input) {
    const entries = Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    );

    // Filter out excluded keys
    const filteredEntries = entries.filter(([key]) => {
      if (
        toolName === "fileEdit" &&
        (key === "old_string" || key === "new_string")
      ) {
        return false;
      }
      return true;
    });

    // Format each parameter
    const params = filteredEntries.map(([key, value], _, array) => {
      // Handle file paths
      if (
        (key === "filePath" || key === "path") &&
        typeof value === "string"
      ) {
        if (path.isAbsolute(value)) {
          const absPath = path.resolve(value);
          if (isPathUnderPrefix(absPath, cwd)) {
            return { key, value: path.relative(cwd, absPath) };
          }
        }
        return { key, value };
      }

      return { key, value: String(value) };
    });

    // Format output based on parameter count
    if (params.length === 0) {
      toolInput = "";
    } else if (params.length === 1) {
      const param = params[0];
      toolInput = String(param.value);
    } else {
      toolInput = params
        .map((param) => {
          return `${param.key}: ${param.value}`;
        })
        .join(", ");
    }
  }

  return {
    toolName: displayToolName,
    toolInput,
  };
}

/**
 * Get the appropriate result view component for a tool.
 *
 * @param toolName Name of the tool
 * @returns Render function for the tool's result, or undefined if no custom view
 */
export function getToolResultView(
  toolName: string,
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
      return (toolCall) =>
        React.createElement(MCPResultView, {
          toolCall,
        });
  }
}

/**
 * Check if a tool is readonly
 *
 * @param toolName Name of the tool
 * @returns true if the tool is readonly, false otherwise
 */
export function isToolReadonly(toolName: string): boolean {
  const toolsByName = getToolsByName();
  const tool = toolsByName[toolName];
  return tool ? tool.readonly : false;
}

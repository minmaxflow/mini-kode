/**
 * OpenAI Function Calling Integration
 *
 * Converts internal Tool definitions to the format expected by OpenAI API.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool } from "./types";
import type { ChatCompletionFunctionTool } from "openai/resources";

export type OpenAITool = ChatCompletionFunctionTool;

/**
 * Convert a single tool to OpenAI Function Calling format
 *
 * Uses `zod-to-json-schema` library to convert Zod schema to JSON Schema,
 * or uses the provided jsonSchema directly if available.
 *
 * Note: We use the default target format instead of 'openapi-3.0' because:
 * - Zod's `positive()` constraint → exclusiveMinimum: 0 (number) in default format
 * - Zod's `positive()` constraint → exclusiveMinimum: true (boolean) in openapi-3.0 format
 * - OpenAI API expects exclusiveMinimum to be a number, not a boolean
 *
 * @param tool Internal tool definition
 * @returns Tool definition in OpenAI API format
 */
export function toolToOpenAIFormat(tool: Tool<any, any>): OpenAITool {
  let parameters: Record<string, unknown>;
  
  if (tool.jsonSchema) {
    // Use the provided JSON Schema directly
    parameters = tool.jsonSchema;
  } else {
    // Convert Zod schema to JSON Schema
    const rawSchema = zodToJsonSchema(tool.inputSchema);
    const { $schema, ...schema } = rawSchema;
    parameters = schema;
  }

  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters,
    },
  };
}

/**
 * Convert tool array to OpenAI format in batch
 *
 * @param tools Tool array (can be readonly array)
 * @returns Array of tool definitions in OpenAI API format
 */
export function allToolsToOpenAIFormat(
  tools: readonly Tool<any, any>[],
): OpenAITool[] {
  return tools.map((tool) => toolToOpenAIFormat(tool));
}



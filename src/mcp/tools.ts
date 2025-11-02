/**
 * MCP Tool Adapter
 *
 * Bridges MCP tools to mini-kode's internal tool system.
 * Converts MCP tool definitions to mini-kode's Tool interface.
 *
 * Key Responsibilities:
 * - Convert MCP tool JSON Schema to Zod schemas
 * - Execute MCP tools through MCP client
 * - Handle MCP tool results and convert to mini-kode format
 * - Provide tool metadata (name, description, schema)
 * - Use MCP tool annotations for readonly hint
 */

import type {
  Tool,
  ToolExecutionContext,
  ToolErrorResult,
} from "../tools/types";
import type { MCPTool, MCPClientManager } from "./client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { PermissionRequiredError } from "../tools/types";
import { checkMCPPermission } from "../permissions/policyResolver";
import { z } from "zod";

/**
 * Extract structured result from MCP tool execution
 * Converts MCP tool results to a consistent structured format for LLM consumption
 */
function extractMCPToolResult(result: CallToolResult): Record<string, unknown> {
  // Try structured content first (preferred for LLM)
  if (result.structuredContent) {
    return { structuredContent: result.structuredContent };
  }

  // Fallback to text content
  if (result.content?.length) {
    const textContent = result.content
      .filter(
        (item): item is { type: "text"; text: string } =>
          item.type === "text" && typeof item.text === "string",
      )
      .map((item) => item.text)
      .join("\n");

    if (textContent) {
      return { textContent };
    }
  }

  // Empty result
  return { result: "MCP tool executed successfully" };
}

/**
 * Adapter that converts MCP tools to mini-kode's Tool interface
 */
export class MCPToolAdapter
  implements Tool<unknown, Record<string, unknown> | ToolErrorResult>
{
  constructor(
    private mcpTool: MCPTool,
    private mcpClientManager: MCPClientManager,
    private serverName: string,
  ) {}

  /**
   * Get tool name formatted as "serverName_toolName_mcp" for OpenAI compatibility
   */
  get name(): string {
    // Normalize tool name for OpenAI API (only alphanumeric, underscore, hyphen)
    const normalizedToolName = this.mcpTool.name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    const normalizedServerName = this.serverName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    return `${normalizedServerName}_${normalizedToolName}_mcp`;
  }

  /**
   * Get user-friendly display name
   */
  get displayName(): string {
    return `${this.serverName} - ${this.mcpTool.name} (MCP)`;
  }

  /**
   * Get tool description
   */
  get description(): string {
    return (
      this.mcpTool.description ||
      this.mcpTool.annotations?.title ||
      `MCP tool: ${this.mcpTool.name}`
    );
  }

  /**
   * MCP tools provide JSON Schema directly, so we return a simple Zod object
   * that will be overridden by the jsonSchema field for OpenAI conversion
   */
  get inputSchema() {
    return z.object({});
  }

  /**
   * Provide the MCP tool's native JSON Schema directly
   * This will be used by toolToOpenAIFormat instead of converting from Zod
   */
  get jsonSchema() {
    return this.mcpTool.inputSchema;
  }

  /**
   * Use MCP tool's readOnlyHint annotation to determine if tool is readonly
   * Defaults to false if annotation is not provided
   */
  get readonly(): boolean {
    return this.mcpTool.annotations?.readOnlyHint ?? false;
  }

  /**
   * Execute the MCP tool
   *
   * This method:
   * 1. Gets the MCP client for the server
   * 2. Calls the tool with provided input
   * 3. Extracts and returns the result content
   *
   * @param input - Tool input parameters
   * @param context - Execution context (cwd, signal, etc.)
   * @returns Tool execution result
   * @throws Error if server is not connected or tool execution fails
   */
  async execute(
    input: unknown,
    context: ToolExecutionContext,
  ): Promise<Record<string, unknown> | ToolErrorResult> {
    // Check abort signal at entry point
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    // Skip permission check for readonly tools
    if (!this.readonly) {
      // Check MCP permission first
      const permissionResult = checkMCPPermission(
        context.cwd,
        this.serverName,
        this.mcpTool.name,
        context.approvalMode,
      );

      if (!permissionResult.ok) {
        throw new PermissionRequiredError({
          kind: "mcp",
          serverName: this.serverName,
          toolName: this.mcpTool.name,
          displayName: this.displayName,
          message: permissionResult.message,
        });
      }
    }

    // Check abort signal before expensive operation
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    // Get the MCP client for this server
    const client = this.mcpClientManager.getClient(this.serverName);
    if (!client) {
      return {
        isError: true,
        message: `MCP server '${this.serverName}' is not connected`,
      };
    }

    // Call the MCP tool
    try {
      const result = (await client.callTool({
        name: this.mcpTool.name,
        arguments: input as Record<string, unknown>,
      })) as CallToolResult;

      // Extract structured result for LLM consumption
      return extractMCPToolResult(result);
    } catch (error) {
      return { isError: true, message: `MCP tool execution failed: ${error}` };
    }
  }
}

/**
 * Create mini-kode tools from all connected MCP servers
 *
 * This function:
 * 1. Gets all connected MCP servers
 * 2. Creates adapters for each MCP tool
 * 3. Returns array of mini-kode compatible tools
 *
 * @param mcpClientManager - MCP client manager instance
 * @returns Array of mini-kode tools
 */
export function createMCPTools(
  mcpClientManager: MCPClientManager,
): Tool<unknown, Record<string, unknown> | ToolErrorResult>[] {
  const tools: Tool<unknown, Record<string, unknown> | ToolErrorResult>[] = [];
  const serverStates = mcpClientManager.getServerStates();

  // Iterate through all connected servers
  for (const serverState of serverStates) {
    if (serverState.status === "connected") {
      // Create adapters for each tool in this server
      for (const mcpTool of serverState.tools) {
        const adapter = new MCPToolAdapter(
          mcpTool,
          mcpClientManager,
          serverState.name,
        );
        tools.push(adapter);
      }
    }
  }

  return tools;
}

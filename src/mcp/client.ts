/**
 * MCP Client Manager
 *
 * Core component for managing MCP (Model Context Protocol) server connections.
 * Supports stdio and HTTP transport types.
 *
 * Key Features:
 * - Multi-transport support with automatic detection
 * - Async connection management with status tracking
 * - Tool discovery and registration
 * - Error handling and recovery
 * - Graceful shutdown
 * - Environment variable resolution for args and headers
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import type { MCPConfig } from "../config/types";
import type { MCPServerConfig, TransportType } from "./types";

export type { MCPTool };

/**
 * MCP server connection status
 */
export interface MCPServerState {
  name: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  error?: string;
  tools: MCPTool[];
}

/**
 * Resolve environment variable references in strings
 * 
 * Supports ${ENV_VAR} syntax. If environment variable is not found,
 * the original reference is kept.
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
    return process.env[envVar] || match;
  });
}

/**
 * Resolve environment variable references in command line arguments
 */
function resolveArgs(args: string[] | undefined): string[] {
  if (!args) return [];
  return args.map(arg => resolveEnvVars(arg));
}

/**
 * Resolve environment variable references in headers
 */
function resolveHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) return {};
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    resolved[key] = resolveEnvVars(value);
  }
  return resolved;
}

export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private states: Map<string, MCPServerState> = new Map();

  /**
   * Initialize MCP servers from configuration
   *
   * @param config - MCP configuration object
   * @returns Promise that resolves when all servers are initialized
   */
  async initializeFromConfig(config: MCPConfig): Promise<void> {
    const serverNames = Object.keys(config.servers);

    // Connect to all servers in parallel for better startup performance
    const connectionPromises = serverNames.map((name) => {
      const serverConfig = config.servers[name];
      return this.connectServer(name, serverConfig);
    });

    await Promise.allSettled(connectionPromises);
  }

  /**
   * Connect to a single MCP server
   *
   * @param name - Server name
   * @param config - Server configuration
   * @returns Promise that resolves when connection is established
   */
  private async connectServer(
    name: string,
    config: MCPServerConfig,
  ): Promise<void> {
    // Update state to connecting
    this.states.set(name, {
      name,
      status: "connecting",
      tools: [],
    });

    try {
      const transport = this.createTransport(name, config);

      const client = new Client(
        {
          name: "mini-kode",
          version: "0.1.1",
        }
      );

      await client.connect(transport);

      // Get available tools
      const toolsResult = await client.listTools();
      const tools: MCPTool[] = toolsResult.tools;

      // Update state to connected
      this.states.set(name, {
        name,
        status: "connected",
        tools,
      });

      this.clients.set(name, client);
    } catch (error) {
      // Update state to error
      this.states.set(name, {
        name,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        tools: [],
      });
    }
  }

  /**
   * Create appropriate transport based on configuration
   *
   * @param name - Server name for error messages
   * @param config - Server configuration
   * @returns Transport instance
   * @throws Error if transport configuration is invalid
   */
  private createTransport(
    name: string,
    config: MCPServerConfig,
  ) {
    // Auto-detect transport type based on configuration
    const transportType = this.detectTransportType(config);

    switch (transportType) {
      case "stdio":
        if (!config.command) {
          throw new Error(
            `MCP server '${name}' requires 'command' for stdio transport`,
          );
        }
        return new StdioClientTransport({
          command: config.command,
          args: resolveArgs(config.args),
        });

      case "http":
        if (!config.url) {
          throw new Error(
            `MCP server '${name}' requires 'url' for HTTP transport`,
          );
        }
        return new StreamableHTTPClientTransport(new URL(config.url), {
          requestInit: {
            headers: resolveHeaders(config.headers),
          },
        });

      default:
        throw new Error(
          `Unsupported transport type for MCP server '${name}': ${transportType}`,
        );
    }
  }

  /**
   * Detect transport type from configuration
   *
   * @param config - Server configuration
   * @returns Detected transport type
   */
  private detectTransportType(config: MCPServerConfig): TransportType {
    // Use explicit transport if specified
    if (config.transport) {
      return config.transport;
    }

    // Auto-detect based on configuration
    if (config.command) {
      return "stdio";
    }
    if (config.url) {
      return "http";
    }

    throw new Error("Could not detect transport type from configuration");
  }

  /**
   * Gracefully shutdown all MCP connections
   *
   * @returns Promise that resolves when all connections are closed
   */
  async shutdown(): Promise<void> {
    const closePromises = Array.from(this.clients.values()).map((client) =>
      client.close().catch((error) => {
        // ignore error
      }),
    );

    await Promise.allSettled(closePromises);
    this.clients.clear();
    this.states.clear();
  }

  /**
   * Get MCP client by server name
   *
   * @param name - Server name
   * @returns Client instance or undefined if not connected
   */
  getClient(name: string): Client | undefined {
    return this.clients.get(name);
  }

  /**
   * Get all server connection states
   *
   * @returns Array of server states
   */
  getServerStates(): MCPServerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get all tools from all connected servers
   *
   * @returns Array of all available MCP tools
   */
  getTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const state of this.states.values()) {
      allTools.push(...state.tools);
    }
    return allTools;
  }

  /**
   * Check if all servers are connected
   *
   * @returns True if all servers are connected, false otherwise
   */
  isAllConnected(): boolean {
    for (const state of this.states.values()) {
      if (state.status !== "connected") {
        return false;
      }
    }
    return true;
  }

  /**
   * Get connection statistics
   *
   * @returns Object with connection counts
   */
  getConnectionStats() {
    const states = Array.from(this.states.values());
    return {
      total: states.length,
      connected: states.filter((s) => s.status === "connected").length,
      connecting: states.filter((s) => s.status === "connecting").length,
      error: states.filter((s) => s.status === "error").length,
      disconnected: states.filter((s) => s.status === "disconnected").length,
    };
  }
}

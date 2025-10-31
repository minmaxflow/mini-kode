/**
 * MCP Types
 *
 * Type definitions for MCP (Model Context Protocol) server configurations
 * and related data structures.
 */

/**
 * MCP server configuration
 * 
 * This type defines the configuration for connecting to an MCP server.
 * It supports multiple transport types and connection methods.
 * 
 * @example stdio transport with environment variable references in args
 * {
 *   "transport": "stdio",
 *   "command": "my-mcp-server",
 *   "args": ["--api-key", "${MCP_API_KEY}", "--database", "${DB_URL}"]
 * }
 * 
 * @example Web transport with environment variable references in headers
 * {
 *   "transport": "http",
 *   "url": "https://api.example.com/mcp",
 *   "headers": {
 *     "Authorization": "Bearer ${ACCESS_TOKEN}",
 *     "X-API-Key": "${API_KEY}"
 *   }
 * }
 */
export interface MCPServerConfig {
  /** Command to execute for stdio transport */
  command?: string;
  /** Command line arguments (supports ${ENV_VAR} environment variable references) */
  args?: string[];
  /** URL for HTTP/SSE/WebSocket transports */
  url?: string;
  /** Transport type (auto-detected if not specified) */
  transport?: "stdio" | "sse" | "http" | "websocket";
  /** HTTP headers for Web transports (supports ${ENV_VAR} environment variable references) */
  headers?: Record<string, string>;
}

/**
 * Transport type for MCP server connections
 */
export type TransportType = "stdio" | "sse" | "http" | "websocket";
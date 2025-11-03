/**
 * MCPDetailView component - Detailed view of MCP servers and tools
 *
 * This component displays a comprehensive overview of MCP server statuses
 * and available tools in a clean, organized layout.
 */

import { Box, Text } from "ink";

import type { MCPServerState } from "../../mcp/client";
import { getCurrentTheme } from "../theme";
import { useTerminalWidth } from "../hooks/useTerminalWidth";

export interface MCPDetailViewProps {
  /**
   * Array of MCP server states
   */
  serverStates: MCPServerState[];
}

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "connected":
      return getCurrentTheme().success;
    case "connecting":
      return getCurrentTheme().warning;
    case "error":
      return getCurrentTheme().error;
    default:
      return getCurrentTheme().secondary;
  }
};

// Helper function to get status symbol
const getStatusSymbol = (status: string) => {
  switch (status) {
    case "connected":
      return "●";
    case "connecting":
      return "◐";
    case "error":
      return "✗";
    default:
      return "○";
  }
};

/**
 * MCPDetailView component
 *
 * Displays MCP server status and available tools in a clean layout
 */
export function MCPDetailView({
  serverStates,
}: MCPDetailViewProps) {
  if (serverStates.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color={getCurrentTheme().secondary}>
          No MCP servers configured
        </Text>
      </Box>
    );
  }

  // Get connected servers for tools display
  const connectedServers = serverStates.filter(server => server.status === "connected");
  const totalTools = connectedServers.reduce((sum, server) => sum + server.tools.length, 0);
  const terminalWidth = useTerminalWidth();

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={getCurrentTheme().brand} bold>
          MCP Servers & Tools
        </Text>
      </Box>

      {/* Server Status Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={getCurrentTheme().accent} bold>
          Server Status:
        </Text>
        {serverStates.map((server) => (
          <Box key={server.name} flexDirection="row" marginLeft={1} gap={1}>
            <Box width={3}>
              <Text color={getStatusColor(server.status)}>
                {getStatusSymbol(server.status)}
              </Text>
            </Box>
            <Box width={46}>
              <Text>{server.name}</Text>
            </Box>
            <Box>
              <Text color={getCurrentTheme().secondary}>
                {server.status}
                {server.error && ` - ${server.error}`}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Tools Section */}
      <Box flexDirection="column">
        <Text color={getCurrentTheme().accent} bold>
          Available Tools ({totalTools}):
        </Text>
        {connectedServers.length === 0 ? (
          <Box marginLeft={1}>
            <Text color={getCurrentTheme().secondary}>
              No tools available (no connected servers)
            </Text>
          </Box>
        ) : (
          connectedServers
            .flatMap(server => 
              server.tools.map(tool => ({
                ...tool,
                serverName: server.name
              }))
            )
            .map((tool, index) => (
              <Box key={`${tool.serverName}-${tool.name}`} flexDirection="row" marginLeft={1} gap={1}>
                <Box width={50}>
                  <Text>
                    {tool.serverName}.{tool.name}
                  </Text>
                </Box>
                <Box width={terminalWidth - 60}>
                  <Text color={getCurrentTheme().secondary}>
                    {tool.description || "No description"}
                  </Text>
                </Box>
              </Box>
            ))
        )}
      </Box>
    </Box>
  );
}
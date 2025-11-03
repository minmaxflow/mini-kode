import { Box, Text } from "ink";

import type { ApprovalMode } from "../../config";
import type { MCPServerState } from "../../mcp/client";
import { getCurrentTheme } from "../theme";

// MCP status indicator component
interface MCPStatusProps {
  mcp: MCPServerState[];
}

function MCPStatus({ mcp }: MCPStatusProps) {
  if (mcp.length === 0) {
    return null;
  }

  const connected = mcp.filter((s) => s.status === "connected").length;
  const connecting = mcp.filter((s) => s.status === "connecting").length;
  const error = mcp.filter((s) => s.status === "error").length;

  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor>MCP:</Text>
      {connected > 0 && (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor color={getCurrentTheme().success}>
            ●
          </Text>
          <Text dimColor>{connected}</Text>
        </Box>
      )}
      {connecting > 0 && (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor color={getCurrentTheme().warning}>
            ●
          </Text>
          <Text dimColor>{connecting}</Text>
        </Box>
      )}
      {error > 0 && (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor color={getCurrentTheme().error}>
            ●
          </Text>
          <Text dimColor>{error}</Text>
        </Box>
      )}
    </Box>
  );
}

// Token usage color thresholds (percentage of 128K context window)
const TOKEN_COLOR_THRESHOLDS = {
  WARNING: 102000, // 80% of 128K
  ERROR: 115000, // 90% of 128K
} as const;

export interface HelpBarProps {
  message?: string; // current message to show
  approvalMode?: ApprovalMode; // current approval mode
  helpMode?: boolean;
  mcp?: MCPServerState[]; // MCP servers state
  tokenUsage?: {
    total_tokens: number;
  };
}

const getStatusMessage = (approvalMode?: ApprovalMode) => {
  if (approvalMode === "autoEdit") {
    return "⏵⏵ accept edits on ";
  } else if (approvalMode === "yolo") {
    return "⏵⏵ bypass permissions on ";
  }
  return ""; // default mode shows nothing
};

export function HelpBar({
  message,
  approvalMode,
  helpMode = false,
  mcp = [],
  tokenUsage,
}: HelpBarProps) {
  const statusMessage = getStatusMessage(approvalMode);

  // Determine what to show on the right side
  const rightContent = message ? (
    <Text dimColor>{message}</Text>
  ) : (
    <MCPStatus mcp={mcp} />
  );

  // Format token display
  const formatTokenDisplay = (tokens: number): string => {
    if (tokens < 1000) return `${tokens}`;
    return `${Math.round(tokens / 1000)}K`;
  };

  const getTokenColor = (tokens: number): string | undefined => {
    if (tokens < TOKEN_COLOR_THRESHOLDS.WARNING) return undefined; // < 80% - green
    if (tokens < TOKEN_COLOR_THRESHOLDS.ERROR) return getCurrentTheme().warning; // 80-90% - yellow
    return getCurrentTheme().error; // > 90% - red
  };

  const tokenDisplay = tokenUsage
    ? `${formatTokenDisplay(tokenUsage.total_tokens)}/128K`
    : null;

  // Detailed help items in two columns
  const detailedHelpItems = [
    ["@ for file paths", "/ for commands"],
    ["shift + tab to cycle approve mode", "ctrl + c twice to exit"],
    ["option + enter for line break", "double tap esc to clear input"],
    ["ctrl + e to open external editor", ""],
  ];

  return (
    <Box width="100%" flexDirection="column" paddingX={1}>
      {/* Help mode - full screen help */}
      {helpMode ? (
        <Box width="100%" flexDirection="column">
          {detailedHelpItems.map((row, rowIndex) => (
            <Box
              key={rowIndex}
              width="100%"
              flexDirection="row"
              justifyContent="space-between"
            >
              <Box width="50%">
                <Text color={getCurrentTheme().secondary}>{row[0]}</Text>
              </Box>
              <Box width="50%" justifyContent="flex-end">
                <Text color={getCurrentTheme().secondary}>{row[1]}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <>
          {/* Main help bar */}
          <Box width="100%" flexDirection="row" justifyContent="space-between">
            <Box flexShrink={0} marginRight={2}>
              {statusMessage && (
                <Text
                  color={
                    approvalMode === "autoEdit"
                      ? getCurrentTheme().warning
                      : approvalMode === "yolo"
                        ? getCurrentTheme().error
                        : undefined
                  }
                >
                  {statusMessage}
                </Text>
              )}
              <Text dimColor>? for shortcuts</Text>
            </Box>
            <Box flexGrow={1} justifyContent="flex-end" marginLeft={2}>
              <Box flexDirection="row" alignItems="center" gap={2}>
                {rightContent}
                {tokenDisplay && (
                  <Text
                    dimColor
                    color={getTokenColor(tokenUsage!.total_tokens)}
                  >
                    {tokenDisplay}
                  </Text>
                )}
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

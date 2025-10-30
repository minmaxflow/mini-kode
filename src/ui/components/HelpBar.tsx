import { Box, Text } from "ink";

import type { ApprovalMode } from "../../config";
import { getCurrentTheme } from "../theme";

// Token usage color thresholds (percentage of 128K context window)
const TOKEN_COLOR_THRESHOLDS = {
  WARNING: 102000, // 80% of 128K
  ERROR: 115000, // 90% of 128K
} as const;

export interface HelpBarProps {
  message?: string; // current message to show
  approvalMode?: ApprovalMode; // current approval mode
  showDetailedHelp?: boolean;
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
  showDetailedHelp = false,
  tokenUsage,
}: HelpBarProps) {
  const statusMessage = getStatusMessage(approvalMode);
  const rightMessage = message ?? "ctrl+a for help";

  // Format token display
  const formatTokenDisplay = (tokens: number): string => {
    if (tokens < 1000) return `${tokens}`;
    return `${Math.round(tokens / 1000)}K`;
  };

  const getTokenColor = (tokens: number): string => {
    if (tokens < TOKEN_COLOR_THRESHOLDS.WARNING)
      return getCurrentTheme().success; // < 80% - green
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
          <Text dimColor>(shift+tab to cycle)</Text>
        </Box>
        <Box flexGrow={1} justifyContent="flex-end" marginLeft={2}>
          <Box flexDirection="row" gap={2}>
            <Text dimColor>{rightMessage}</Text>
            {tokenDisplay && (
              <Text color={getTokenColor(tokenUsage!.total_tokens)}>
                {tokenDisplay}
              </Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Detailed help section */}
      {showDetailedHelp && (
        <Box width="100%" flexDirection="column" marginTop={1}>
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
      )}
    </Box>
  );
}

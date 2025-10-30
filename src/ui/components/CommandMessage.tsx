import { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";

import { getCurrentTheme } from "../theme";
import { CommandCall } from "../commands";
import { InkMarkdown } from "./InkMarkdown";
import { useTerminalWidth } from "../hooks/useTerminalWidth";

export interface CommandMessageProps {
  commandMessage: CommandCall;
}

export function CommandMessage({ commandMessage }: CommandMessageProps) {
  const { commandName, status, result, error } = commandMessage;
  const terminalWidth = useTerminalWidth();

  /**
   * Loading animation for executing status
   * Toggles between the icon and a blank space to create a blinking effect
   */
  const [loadingIconIndex, setLoadingIconIndex] = useState(0);
  const loadingIcons = useMemo(() => ["●", " "], []);

  useEffect(() => {
    if (status !== "executing") {
      return;
    }

    const interval = setInterval(() => {
      setLoadingIconIndex((prev) => (prev + 1) % loadingIcons.length);
    }, 500);

    return () => clearInterval(interval);
  }, [status, loadingIcons.length]);

  // Special handling for /init command: don't render CommandMessage
  // /init command's purpose is to send a prompt to LLM for project analysis
  // The actual execution and results will be shown through normal LLM message flow
  // This avoids duplicate UI elements and provides cleaner user experience
  if (commandName === "/init") {
    return null;
  }

  // Special handling for /clear command: show "(No content)"
  if (commandName === "/clear") {
    return (
      <Box flexDirection="row" marginTop={1}>
        <Box marginRight={1}>
          <Text>{">"}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Text bold>{commandName}</Text>
          <Box>
            <Box>
              <Text>⎿{"  "}</Text>
            </Box>
            <Text color={getCurrentTheme().secondary}>(no content)</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Special handling for /compact command: compact display
  if (commandName === "/compact") {
    let iconColor: string | undefined = undefined;
    let displayContent: React.ReactNode = "";

    switch (status) {
      case "executing":
        iconColor = getCurrentTheme().warning;
        displayContent = <Text>compacting conversion...</Text>;
        break;
      case "success":
        iconColor = getCurrentTheme().success;
        // Use markdown component for success result
        displayContent = result ? (
          <InkMarkdown>{result}</InkMarkdown>
        ) : (
          <Text>Completed</Text>
        );
        break;
      case "error":
        iconColor = getCurrentTheme().error;
        displayContent = (
          <Text color={getCurrentTheme().error}>{error || "Failed"}</Text>
        );
        break;
    }

    // Add auto-triggered indicator
    const commandDisplay = commandMessage.autoTriggered ? (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text bold>{commandName}</Text>
        <Text color={getCurrentTheme().secondary}>(auto)</Text>
      </Box>
    ) : (
      <Text bold>{commandName}</Text>
    );

    return (
      <Box marginTop={1} width={terminalWidth - 4}>
        <Box marginRight={1}>
          <Text color={iconColor}>
            {status === "executing" ? loadingIcons[loadingIconIndex] : "●"}
          </Text>
        </Box>
        <Box flexDirection="column">
          {commandDisplay}
          <Box flexDirection="row">
            <Box>
              <Text>⎿{"  "}</Text>
            </Box>
            <Box flexDirection="column">{displayContent}</Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
}

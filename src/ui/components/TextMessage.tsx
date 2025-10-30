import { Box, Text } from "ink";

import type { LLMMessage as LLMMessageType } from "../../sessions/types";
import LLMMessage from "./LLMMessage";
import { getCurrentTheme } from "../theme";
import { useTerminalWidth } from "../hooks/useTerminalWidth";
import { APIUserAbortError } from "openai";

export interface TextMessageProps {
  wrappedMessage: LLMMessageType;
  index: number;
}

export function TextMessage({ wrappedMessage, index }: TextMessageProps) {
  const message = wrappedMessage.message;
  const isInterruptedByUser =
    wrappedMessage.status === "error" &&
    wrappedMessage.error instanceof APIUserAbortError;
  const isUserMessage = message.role === "user";
  const terminalWidth = useTerminalWidth();

  // Skip non-text messages (tool messages are handled separately)
  if (message.role === "tool") {
    return null;
  }

  // Skip empty message
  if (!message.content) {
    return;
  }

  // Determine icon and color based on role
  // Using ● instead of ⏺ for better terminal rendering compatibility
  // ⏺ character caused alignment issues in some terminals due to inconsistent width rendering
  const icon = isUserMessage ? ">" : "●";
  let color = isUserMessage ? getCurrentTheme().secondary : undefined;

  if (wrappedMessage.status === "error") {
    color = getCurrentTheme().error;
  }

  return (
    <Box
      key={`message-${index}`}
      flexDirection="column"
      marginTop={1}
      width={terminalWidth - 4}
    >
      <Box flexDirection="row">
        {/* Left column: prefix */}
        <Box marginRight={1}>
          <Text color={color}>{icon}</Text>
        </Box>

        {/* Right column: content */}
        <Box flexDirection="column" flexGrow={1}>
          {isUserMessage ? (
            <Text color={getCurrentTheme().secondary}>
              {typeof message.content === "string" ? message.content : ""}
            </Text>
          ) : (
            <LLMMessage
              markdown={
                typeof message.content === "string" ? message.content : ""
              }
            />
          )}
          {isInterruptedByUser ? (
            <Box>
              <Text color={getCurrentTheme().error}>
                ⎿{"  "}Interrupted by user
              </Text>
            </Box>
          ) : null}
          {/* Note: "[Interrupted by User]" marker in content is handled by InkMarkdown.tsx 
              This UI indicator shows the interruption status separately from the text marker */}
        </Box>
      </Box>
    </Box>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";

import type { PermissionOption } from "../../permissions/types";
import type { ToolCall as ToolCallType } from "../../tools/runner.types";
import { getToolResultView } from "./tool-views";
import { ToolCallView } from "./ToolCallView";
import { getCurrentTheme } from "../theme";

export interface ToolMessageProps {
  toolCall: ToolCallType;
  cwd: string;
  onApprove?: (requestId: string, option: PermissionOption) => void;
  onReject?: (requestId: string) => void;
}

export function ToolMessage({
  toolCall,
  cwd,
  onApprove,
  onReject,
}: ToolMessageProps) {
  const renderView =
    (toolCall.status === "success" || toolCall.status === "abort") &&
    toolCall.result
      ? getToolResultView(toolCall.toolName, cwd)
      : undefined;

  /**
   * Loading animation for executing status
   * Toggles between the icon and a blank space to create a blinking effect
   */
  const [loadingIconIndex, setLoadingIconIndex] = useState(0);
  const loadingIcons = useMemo(() => ["●", " "], []);

  // NOTE: When debugging with DebugToolMessage (static mock data),
  // this useEffect can cause auto-scrolling to top which may interfere
  // with viewing the debug ui. Consider commenting out this effect
  // when using DebugToolMessage for debugging purposes.
  useEffect(() => {
    if (toolCall.status !== "executing") {
      return;
    }

    const interval = setInterval(() => {
      setLoadingIconIndex((prev) => (prev + 1) % loadingIcons.length);
    }, 500);

    return () => clearInterval(interval);
  }, [toolCall.status, loadingIcons.length]);

  let color: string | undefined = undefined;

  if (toolCall.status === "error") {
    color = getCurrentTheme().error;
  } else if (toolCall.status === "success") {
    color = getCurrentTheme().success;
  } else if (toolCall.status === "executing") {
    color = getCurrentTheme().secondary;
  }

  return (
    <Box flexDirection="row" marginTop={1}>
      <Box marginRight={1}>
        <Text color={color}>
          {toolCall.status === "executing"
            ? loadingIcons[loadingIconIndex]
            : "●"}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        <ToolCallView
          call={toolCall}
          cwd={cwd}
          renderView={renderView}
          onApprove={onApprove}
          onReject={onReject}
        />
      </Box>
    </Box>
  );
}

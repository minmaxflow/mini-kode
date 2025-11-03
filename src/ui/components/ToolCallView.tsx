import React from "react";
import { Box, Text } from "ink";

import type { PermissionOption } from "../../permissions/types";
import type { ToolCall } from "../../tools/runner.types";
import { getCurrentTheme } from "../../ui/theme";
import PermissionSelector from "./PermissionSelector";
import { getToolCallTitle } from "./tool-views";
import { useTerminalWidth } from "../hooks/useTerminalWidth";

export interface ToolCallViewProps {
  call: ToolCall;
  cwd: string;
  renderView?: (toolCall: ToolCall, cwd: string) => React.ReactNode;
  onApprove?: (requestId: string, option: PermissionOption) => void;
  onReject?: (requestId: string) => void;
}

/**
 * ToolCall component displays the lifecycle of a single tool execution.
 *
 * Rendering structure (similar to Claude Code):
 *   Tool Name (Input params)
 *   ⎿  Status/Result
 *
 * Statuses:
 * - pending: Waiting to execute
 * - executing: Currently running
 * - permission_required: Waiting for user approval
 * - success: Completed successfully (shows results if available)
 * - error: Failed with error (shows error details)
 * - abort: Aborted by user (currently doesn't show partial results)
 * - permission_denied: Permission was rejected by user
 *
 * Important: For abort status, we currently don't render results because:
 * 1. Current tool implementations don't return partial results when aborted
 * 2. Future designs may include sophisticated logic to determine partial result validity
 */
export function ToolCallView({
  call,
  cwd,
  renderView,
  onApprove,
  onReject,
}: ToolCallViewProps) {
  const { status, requestId } = call;
  const { toolName, toolInput } = getToolCallTitle(call, cwd);

  const terminalWidth = useTerminalWidth();

  return (
    <Box flexDirection="column" width={terminalWidth - 4}>
      {/* First layer: Tool title with bold toolName */}
      <Text>
        <Text bold>{toolName}</Text>
        <Text>{toolInput ? `(${toolInput})` : ""}</Text>
      </Text>

      {/* Second layer: Status/Result with ⎿  prefix */}
      {status === "pending" && (
        <Box>
          <Text dimColor>⎿{"  "}Pending...</Text>
        </Box>
      )}

      {status === "executing" && (
        <Box>
          <Text>⎿{"  "}Running...</Text>
        </Box>
      )}

      {status === "permission_required" && (
        <Box flexDirection="column">
          <Box>
            <Text>⎿{"  "}Running...</Text>
          </Box>
          <Box marginLeft={1}>
            <PermissionSelector
              uiHint={call.uiHint!}
              cwd={cwd}
              onDecide={(option) => {
                if (option.kind === "reject") {
                  onReject?.(requestId);
                } else {
                  onApprove?.(requestId, option);
                }
              }}
            />
          </Box>
        </Box>
      )}

      {status === "abort" && (
        <Box>
          <Text color={getCurrentTheme().error}>
            ⎿{"  "}Interrupted by user
          </Text>
        </Box>
      )}

      {status === "permission_denied" && (
        <Box flexDirection="column">
          <Box>
            <Text color={getCurrentTheme().error}>
              ⎿{"  "}
              {call.rejectionReason === "timeout"
                ? "Permission request timed out"
                : "Rejected by user"}
            </Text>
          </Box>
        </Box>
      )}

      {status === "error" && (
        <Box>
          <ErrorView message={call.result.message} />
        </Box>
      )}

      {status === "success" && (
        <>
          {renderView && (
            <Box>
              <Box>
                <Text>⎿{"  "}</Text>
              </Box>
              <Box>{renderView(call, cwd)}</Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

interface ErrorViewProps {
  message: string;
}

function ErrorView({ message }: ErrorViewProps) {
  return (
    <Box>
      <Text color={getCurrentTheme().error}>
        ⎿{"  "}
        {message}
      </Text>
    </Box>
  );
}

export default ToolCallView;

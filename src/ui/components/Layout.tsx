import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Text } from "ink";

import type { PermissionOption } from "../../permissions/types";
import type { AppState, AppActions } from "../hooks/useAppState";
import { HelpBar } from "./HelpBar";
import { Logo } from "./Logo";
import MessageFeed from "./MessageFeed";
import { PromptInput } from "./PromptInput";
import { getCurrentTheme } from "../theme";
import type { LlmClient } from "../../llm/client";
import { CommandName } from "../commands";

export interface LayoutProps {
  cwd: string;
  state: AppState;
  actions: AppActions;
  onSubmit: (value: string) => void;
  onExit: () => void;
  onApprove: (requestId: string, option: PermissionOption) => void;
  onReject: (requestId: string) => void;
  onCycleApprovalMode: () => void; // Handler for cycling approval mode
  isAgentExecuting?: boolean; // Whether agent is currently executing
  onExecuteCommand: (command: CommandName) => Promise<void>;
}

export function Layout({
  cwd,
  state,
  actions,
  onSubmit,
  onExit,
  onApprove,
  onReject,
  onCycleApprovalMode,
  isAgentExecuting = false,
  onExecuteCommand,
}: LayoutProps) {
  /**
   * Animated loading icons for agent execution
   */
  const [loadingIconIndex, setLoadingIconIndex] = useState(0);
  const loadingIcons = useMemo(() => ["◐", "◓", "◑", "◒"], []);

  useEffect(() => {
    if (!state.isLLMGenerating) {
      return;
    }

    const interval = setInterval(() => {
      setLoadingIconIndex((prev) => (prev + 1) % loadingIcons.length);
    }, 250);

    return () => clearInterval(interval);
  }, [state.isLLMGenerating, loadingIcons.length]);

  /**
   * Check if there are pending permission requests
   *
   * When a tool requires permission, PermissionPrompt is shown in MessageFeed
   * and we hide PromptInput completely to avoid input conflicts.
   * This ensures users can only interact with the permission prompt.
   */
  const hasPermissionRequest = state.toolCalls.some(
    (c) => c.status === "permission_required",
  );

  const logo = useMemo(() => {
    return <Logo />;
  }, []);

  return (
    <Box flexDirection="column">
      <MessageFeed
        messages={state.messages}
        toolCalls={state.toolCalls}
        cwd={cwd}
        onApprove={onApprove}
        onReject={onReject}
        staticHeader={logo}
        clearNum={state.clearNum}
      />

      {/* MCP servers status */}
      {state.mcp.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text>
            MCP: {state.mcp.filter((s) => s.status === "connected").length}/
            {state.mcp.length} connected
          </Text>
          {state.mcp.map((server) => (
            <Box key={server.name} marginLeft={2} flexDirection="column">
              <Text>
                {server.name}: {server.status}{" "}
                {server.tools.length > 0
                  ? `(${server.tools.length} tools)`
                  : ""}
              </Text>
              {server.status === "error" && server.error && (
                <Text color={getCurrentTheme().error}>
                  Error: {server.error}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Error message display */}
      {state.error && (
        <Box marginTop={1} flexDirection="column">
          <Text color={getCurrentTheme().error}>{state.error}</Text>
        </Box>
      )}

      {/* Loading indicator when LLM is generating */}
      {!hasPermissionRequest && state.isLLMGenerating && (
        <Box marginTop={1}>
          <Text color={getCurrentTheme().brand}>
            {loadingIcons[loadingIconIndex]} (Working... esc to cancel)
          </Text>
        </Box>
      )}

      {/* PromptInput and HelpBar rendering logic:
          - Normal state: Render input and help bar  
          - Permission request state: Don't render input (handled by PermissionPrompt) */}
      {!hasPermissionRequest && (
        <Box marginTop={1} flexDirection="column">
          <PromptInput
            onSubmit={onSubmit}
            onExit={onExit}
            cwd={cwd}
            onCycleApprovalMode={onCycleApprovalMode}
            isAgentExecuting={isAgentExecuting}
            state={state}
            actions={actions}
            onExecuteCommand={onExecuteCommand}
          />
        </Box>
      )}
    </Box>
  );
}

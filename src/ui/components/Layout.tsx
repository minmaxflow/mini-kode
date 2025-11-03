import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Text } from "ink";

import type { PermissionOption } from "../../permissions/types";
import type { AppState, AppActions } from "../hooks/useAppState";
import { Logo } from "./Logo";
import { LLMInfoDisplay } from "./LLMInfoDisplay";
import MessageFeed from "./MessageFeed";
import { PromptInput } from "./PromptInput";
import ErrorView from "./ErrorView";
import { CommandName } from "../commands";
import { getCurrentTheme } from "../theme";

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
    return (
      <Box flexDirection="column">
        <Logo />
        <LLMInfoDisplay />
      </Box>
    );
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

      {/* Error display - shows critical errors like LLM API failures */}
      {state.error && (
        <Box marginTop={1}>
          <ErrorView message={state.error} />
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

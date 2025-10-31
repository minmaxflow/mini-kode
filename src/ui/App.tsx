import { useEffect, useCallback, useRef } from "react";
import { useApp, useInput } from "ink";

import { executeAgent } from "../agent/executor";
import type { ExecutionCallbacks } from "../agent/types";
import type { LLMMessage } from "../sessions/types";
import type { ApprovalMode } from "../config";
import type { PermissionUiHint } from "../tools/types";
import { isTransientToolState } from "../tools/runner.types";
import {
  requestUserApproval,
  resolveApproval,
  type PermissionOption,
} from "../tools/permissionRequest";
import { Layout } from "./components/Layout";
import { useAppState } from "./hooks/useAppState";
import { createClient } from "../llm/client";
import { executeCommand } from "./commands/executor";
import { CommandName } from "./commands";
import { ConfigManager } from "../config/manager";
import { mcpService } from "../mcp";

export interface AppProps {
  cwd: string;
  approvalMode?: ApprovalMode;
}

/**
 * Main App component for the mini-kode CLI TUI.
 *
 * State Management:
 * - Uses useAppState Hook to centralize all application state
 *
 * Key Features:
 * - Streaming LLM responses with progressive UI updates
 * - Abort support via AbortController
 * - Double Ctrl+C exit with help message hint
 * - Session management
 */
export function App({ cwd, approvalMode }: AppProps) {
  const { exit } = useApp();

  // Centralized state management via custom Hook
  const { state, actions, refs, getCurrentApprovalMode, buildSession } =
    useAppState(approvalMode);

  // Initialize MCP connections on app start
  useEffect(() => {
    async function initializeMCP() {
      actions.initializeMCP();

      try {
        // Initialize MCP service (async, doesn't block UI)
        await mcpService.initialize(cwd, false);

        // Update UI state with server status
        const serverStates = mcpService.getServerStates();
        for (const serverState of serverStates) {
          actions.updateMCPServer(serverState);
        }

        // Mark initialization complete
        actions.completeMCPInitialization();
      } catch (error) {
        console.error("MCP initialization failed:", error);
        actions.completeMCPInitialization();
      }
    }

    initializeMCP();
  }, [cwd, actions]);

  // ========================================================================
  // AGENT EXECUTION STATE DETECTION
  // ========================================================================
  //
  // Determines if the agent is currently executing any work that should
  // prevent user input or require special UI handling.
  //
  // CONSIDERED STATES:
  // 1. LLM Generation: state.isLLMGenerating (LLM streaming responses)
  // 2. Tool Execution: Any tool call in transient state (pending, executing, permission_required)
  // 3. Command Execution: Any command call in "executing" state
  //
  // IMPORTANT: This logic must be kept in sync with all execution states
  // across the application (LLM, tools, and commands).
  //
  // Calculate if agent is currently executing
  const isAgentExecuting =
    state.isLLMGenerating ||
    state.toolCalls.some((toolCall) => isTransientToolState(toolCall.status)) ||
    state.messages.some(
      (msg) => msg.kind === "cmd" && msg.status === "executing",
    );

  // Handle ESC key to abort execution (LLM generation or tool execution)
  // This is at App level to avoid conflicts with PromptInput's disabled state
  // Note: Don't handle ESC when permission prompts are shown to avoid conflicts
  useInput((_, key) => {
    if (key.escape) {
      // Check if there are any active permission prompts
      const hasPermissionPrompt = state.toolCalls.some(
        (call) => call.status === "permission_required",
      );

      // Only handle abort if there's no permission prompt active
      // PermissionPrompt handles ESC internally for permission rejection
      if (!hasPermissionPrompt) {
        if (isAgentExecuting) {
          actions.abort();
        }
      }
    }
  });

  const handleSubmit = async (value: string): Promise<void> => {
    // Create abort controller for this request
    const ac = actions.createAbortController();
    actions.startRequest(value);

    // Build session from current UI state (includes token usage)
    const session = buildSession();

    // ========================================================================
    // UI PERMISSION PROMISE TRACKING
    // ========================================================================
    // This is the UI side of the async permission flow. Here's how it connects
    // to the executor's permission system:
    //
    // 1. PENDING PROMISES MAP:
    //    - Key: requestId (tool call ID from LLM)
    //    - Value: { resolve } function that completes the permission promise
    //    - This map bridges the gap between async executor and UI state
    //
    // 2. FLOW CONNECTION:
    //    - Executor calls onPermissionRequired() with a requestId
    //    - requestUserApproval stores the resolver in this map
    //    - UI shows permission prompt to user
    //    - User clicks [a]pprove or [r]eject
    //    - UI calls the stored resolve function with user's decision
    //    - Executor's promise resolves and continues execution
    //
    // Prepare callbacks for agent executor
    const callbacks: ExecutionCallbacks = {
      onGeneratingChange: (isGenerating: boolean) => {
        actions.setLLMGenerating(isGenerating);
      },

      onLLMMessageUpdate: (message: LLMMessage) => {
        actions.updateLLMMessage(message);
      },

      onToolStart: (toolCall) => {
        actions.addToolCall(toolCall);
      },

      onToolUpdate: (toolCall) => {
        actions.updateToolCall(toolCall);
      },

      onToolComplete: async (result) => {
        actions.completeToolCall(result);
      },

      // ========================================================================
      // CRITICAL: ASYNC PERMISSION HANDLER
      // ========================================================================
      // This is where the async permission flow connects executor to UI.
      // When a tool needs user approval, this callback gets called.
      onPermissionRequired: async (
        hint: PermissionUiHint,
        requestId: string,
      ) => {
        // How it works:
        // - requestUserApproval() registers a resolver in refs.pendingApprovals.current
        //   and returns a promise that waits for user input
        // - User sees [a]pprove/[r]eject prompt in UI
        // - User makes decision → resolveApproval() is called → promise resolves
        // - This function returns the decision to executor
        // - Executor continues execution (or stops if rejected)
        //
        // Note: The tool call state has already been updated to "permission_required"
        // by the executor before calling this callback, so the UI is ready
        const decision = await requestUserApproval(
          requestId,
          refs.pendingApprovals.current,
        );

        return decision;
      },

      onError: async (error: Error) => {
        actions.setError(error.message);
      },

      onTokenUsageUpdate: (tokenUsage) => {
        actions.updateTokenUsage(tokenUsage);
      },

      onAddCommandCall: (commandCall) => {
        actions.addCommandCall(commandCall);
      },

      onCompleteCommandCall: (commandCall) => {
        actions.completeCommandCall(commandCall);
      },
    };

    // Execute agent
    await executeAgent(
      value,
      {
        cwd,
        signal: ac.signal,
        getApprovalMode: getCurrentApprovalMode,
        session: session,
      },
      callbacks,
    );
  };

  // Execute prompt when set by commands (like /init)
  useEffect(() => {
    if (state.promptToExecute) {
      // Store the prompt and clear it from state to avoid re-execution
      const promptToExecute = state.promptToExecute;
      actions.executePrompt(""); // Clear promptToExecute

      // Execute the prompt through the normal handleSubmit flow
      handleSubmit(promptToExecute.trim());
    }
  }, [state.promptToExecute, actions, handleSubmit]);

  /**
   * Handle user approval of a permission request.
   *
   * Called when user selects an option in the permission prompt.
   * Resolves the pending approval promise, allowing tool execution to continue.
   */
  // ========================================================================
  // USER APPROVAL HANDLER - COMPLETING THE ASYNC LOOP
  // ========================================================================
  //
  // This function is called when the user chooses an approval option.
  // It completes the async promise that was created in onPermissionRequired().
  //
  // FLOW COMPLETION:
  // 1. User approves the permission
  // 2. This function gets called with the user's choice
  // 3. resolveApproval() finds the stored resolve function
  // 4. Calls the resolve function with user's decision
  // 5. The promise in onPermissionRequired() resolves
  // 6. Executor gets the decision and continues/stops execution
  // 7. UI updates with tool execution progress
  const handleApprove = (requestId: string, option: PermissionOption): void => {
    resolveApproval(
      requestId,
      { approved: true, option },
      refs.pendingApprovals.current,
    );
  };

  // ========================================================================
  // USER REJECTION HANDLER - COMPLETING THE ASYNC LOOP
  // ========================================================================
  //
  // This function is called when the user rejects a permission request.
  // It completes the async promise with a rejection decision.
  //
  // FLOW COMPLETION:
  // 1. User presses [r] (reject)
  // 2. This function gets called with the requestId
  // 3. resolveApproval() finds the stored resolve function
  // 4. Calls the resolve function with rejection decision
  // 5. The promise in onPermissionRequired() resolves with rejection
  // 6. Executor receives rejection and stops tool execution
  // 7. UI updates showing the tool was rejected
  const handleReject = (requestId: string): void => {
    resolveApproval(
      requestId,
      { approved: false, reason: "user_rejected" },
      refs.pendingApprovals.current,
    );
  };

  /**
   * Execute slash commands using the command executor.
   * This handler is passed to PromptInput to centralize command execution at the App level.
   */
  const handleExecuteCommand = useCallback(
    async (command: CommandName): Promise<void> => {
      // Execute command using the executor
      await executeCommand(
        command,
        state.messages,
        createClient({
          cwd,
        }),
        actions,
        handleSubmit,
      );

      // For backward compatibility, only add commands that don't manage their own state
      // Currently all commands manage their own state, so no special handling needed
    },
    [state.messages, actions, handleSubmit, cwd],
  );

  const handleExit = (): void => {
    exit();
  };

  return (
    <Layout
      cwd={cwd}
      state={state}
      actions={actions}
      onSubmit={handleSubmit}
      onExit={handleExit}
      onApprove={handleApprove}
      onReject={handleReject}
      onCycleApprovalMode={actions.cycleApprovalMode}
      isAgentExecuting={isAgentExecuting}
      onExecuteCommand={handleExecuteCommand}
    />
  );
}

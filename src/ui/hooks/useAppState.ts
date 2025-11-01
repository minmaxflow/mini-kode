import { useCallback, useReducer, useRef } from "react";

import type { ApprovalMode } from "../../config";
import type { ApprovalPromise } from "../../tools/permissionRequest";
import type { LLMMessage, Session } from "../../sessions/types";
import { wrapAsLLMMessage } from "../../sessions/types";
import type { UIFeedMessage } from "../types";
import type { ToolCall } from "../../tools/runner.types";
import type { TokenUsage } from "../../llm/client";
import { createDebugAppState } from "../debug/appStateDebug";
import {
  isTerminalToolState,
  isTransientToolState,
  ToolCallRunning,
  ToolCallNonTerminal,
  ToolCallTerminal,
} from "../../tools/runner.types";
import { formatToolResultMessage } from "../../agent/formatters";
import { CommandCall } from "../commands";
import type { MCPServerState } from "../../mcp/client";

// Simplified MCP state updates
function updateMCPServers(
  servers: MCPServerState[],
  action: Action,
): MCPServerState[] {
  switch (action.type) {
    case "MCP_SERVER_UPDATE":
      const existingIndex = servers.findIndex(
        (s) => s.name === action.payload.name,
      );
      if (existingIndex !== -1) {
        // Update existing server
        return servers.map((s) =>
          s.name === action.payload.name ? action.payload : s,
        );
      } else {
        // Insert new server
        return [...servers, action.payload];
      }

    default:
      return servers;
  }
}
/**
 * Application state managed by the App component.
 */
export type AppState = {
  isLLMGenerating: boolean;
  // Lifecycle: true when OpenAI API is actively streaming content back to us
  // - Set to true: START_REQUEST action (user submits prompt)
  // - Set to false: onStreamingResponse when response.isComplete === true
  // - Set to false: Any error condition (SET_ERROR action)
  // - Set to false: User abort (ABORT action)
  // This precisely tracks LLM streaming phase, not tool execution or permission waiting

  // Session data stored separately (not as Session object)
  sessionId: string;
  messages: UIFeedMessage[]; // UI layer manages its own message format
  toolCalls: ToolCall[];

  /** Error message displayed in UI for critical failures:
   * - LLM API errors (401 auth, 429 rate limit, 400 model not found, etc.)
   * - Agent execution failures that prevent continuing
   * Not used for individual tool failures (those appear in tool results)
   */
  error?: string;
  /** Current approval mode for this session (can be cycled with Shift+Tab) */
  currentApprovalMode: ApprovalMode;
  /** Prompt to execute (set by commands that need agent execution) */
  promptToExecute?: string;

  /** Token usage for current session */
  tokenUsage: TokenUsage;

  clearNum: number;

  /** MCP servers state */
  mcp: MCPServerState[];
};

/**
 * Type alias for the actions object returned by useAppState hook.
 * Provides type-safe access to all state management functions.
 */
export type AppActions = ReturnType<typeof useAppState>["actions"];

/**
 * Actions for updating application state.
 */
type Action =
  | {
    type: "START_REQUEST";
    userMessage: string;
  }
  | { type: "SET_GENERATING"; isLLMGenerating: boolean }
  | { type: "UPDATE_STREAMING_MESSAGE"; content: string }
  | { type: "COMPLETE_LLM_MESSAGE"; message: LLMMessage }
  | { type: "SET_ERROR"; error?: string }
  | { type: "ADD_TOOL_CALL"; toolCall: ToolCallRunning }
  | {
    type: "UPDATE_TOOL_CALL";
    toolCall: ToolCallNonTerminal;
  }
  | {
    type: "COMPLETE_TOOL_CALL";
    toolCall: ToolCallTerminal;
  }
  | { type: "CYCLE_APPROVAL_MODE" }
  | { type: "EXECUTE_PROMPT"; prompt: string }
  | {
    type: "ADD_COMMAND_CALL";
    commandCall: CommandCall;
  }
  | {
    type: "COMPLETE_COMMAND_CALL";
    commandCall: CommandCall;
  }
  | { type: "CLEAR_SESSION" }
  | { type: "UPDATE_TOKEN_USAGE"; tokenUsage: TokenUsage }
  | { type: "MCP_SERVER_UPDATE"; payload: MCPServerState };

/**
 * State reducer for managing App state transitions.
 *
 * Benefits of using a reducer:
 * - Centralized state transition logic
 * - Easy to test (pure function)
 * - Reduces number of setState calls
 * - Makes state relationships explicit
 *
 * @param state Current state
 * @param action Action to apply
 * @returns New state
 */
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "EXECUTE_PROMPT":
      return { ...state, promptToExecute: action.prompt };

    case "START_REQUEST":
      // Start new request - add user message to messages immediately
      const userMessageWrapped: LLMMessage = {
        kind: "api",
        status: "complete",
        message: {
          role: "user",
          content: action.userMessage,
        },
      };
      return {
        ...state,
        error: undefined, // Clear any previous errors
        messages: [...state.messages, userMessageWrapped],
      };

    case "UPDATE_STREAMING_MESSAGE": {
      // Update or add assistant message (wrapped form)
      const messages = [...state.messages];
      const last = messages[messages.length - 1];

      // Check if last message is an LLM assistant message
      if (last && last.kind === "api" && last.message.role === "assistant") {
        // Streaming updates should never arrive for terminal messages
        // If this happens, it indicates a bug in the message flow logic
        if (last.status === "error" || last.status === "complete") {
          throw new Error(
            `UPDATE_STREAMING_MESSAGE: Cannot update message with terminal status '${last.status}'. This indicates a race condition or bug in message flow.`,
          );
        }

        // Update existing assistant streaming message
        const updated: LLMMessage = {
          ...last,
          message: {
            ...last.message,
            content: action.content,
          },
        };
        messages[messages.length - 1] = updated;
      } else {
        // Add new assistant streaming message
        const assistant: LLMMessage = {
          kind: "api",
          status: "streaming",
          message: {
            role: "assistant",
            content: action.content,
          },
        };
        messages.push(assistant);
      }

      return {
        ...state,
        messages,
      };
    }

    case "COMPLETE_LLM_MESSAGE": {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      const last = messages[lastIndex];

      // For assistant messages: replace streaming message with complete one
      if (action.message.message.role === "assistant") {
        // Replace if last message is a streaming assistant message
        if (
          last &&
          last.kind === "api" &&
          last.status === "streaming" &&
          last.message.role === "assistant"
        ) {
          messages[lastIndex] = action.message;
        } else {
          // Otherwise append (shouldn't happen in normal flow)
          messages.push(action.message);
        }
      }
      // For tool messages: check for duplicates before appending
      else if (action.message.message.role === "tool") {
        const newToolCallId = action.message.message.tool_call_id;
        const isDuplicate = messages.some(
          (msg) =>
            msg.kind === "api" &&
            msg.message.role === "tool" &&
            msg.message.tool_call_id === newToolCallId,
        );

        if (isDuplicate) {
          throw new Error(
            `Duplicate tool message detected for tool_call_id: ${newToolCallId}. This indicates a bug in the tool execution logic.`,
          );
        }

        messages.push(action.message);
      }
      // For other message types: append
      else {
        messages.push(action.message);
      }

      return {
        ...state,
        messages,
      };
    }

    case "SET_GENERATING":
      return { ...state, isLLMGenerating: action.isLLMGenerating };

    case "SET_ERROR":
      // Note: isLLMGenerating will be set to false by executor via onGeneratingChange callback
      return { ...state, error: action.error };

    case "ADD_TOOL_CALL":
      // Runtime type check: ADD_TOOL_CALL should only receive ToolCallRunning (status: "executing")
      const toolCall = action.toolCall;
      // Type guard to ensure toolCall has status property
      if (toolCall.status !== "executing") {
        throw new Error(
          `ADD_TOOL_CALL: Expected status 'executing', but got '${toolCall.status}'. This indicates a bug in the callback system.`,
        );
      }

      // Check for duplicate tool calls
      const duplicateIndex = state.toolCalls.findIndex(
        (call) => call.requestId === toolCall.requestId,
      );
      if (duplicateIndex !== -1) {
        throw new Error(
          `ADD_TOOL_CALL: Tool call with requestId ${toolCall.requestId} already exists. This indicates a duplicate call or bug in the tool execution logic.`,
        );
      }

      return {
        ...state,
        toolCalls: [...state.toolCalls, toolCall],
      };

    case "UPDATE_TOOL_CALL": {
      // ========================================================================
      // UPDATE_TOOL_CALL - Update Tool State (Non-Terminal States)
      // ========================================================================
      //
      // This action updates tool call state for non-terminal states.
      // Unlike COMPLETE_TOOL_CALL, this does NOT add tool messages.
      //
      // USE CASES:
      // - Update tool from "pending" to "executing" after permission granted
      // - Update progress or intermediate state
      // - Any state transition that doesn't complete the tool
      //
      // DESIGN: Separate from COMPLETE_TOOL_CALL for clarity
      // - UPDATE_TOOL_CALL: Non-terminal states, no message
      // - COMPLETE_TOOL_CALL: Terminal states only, auto-derives message
      //
      const toolCall = action.toolCall;

      // Runtime type check: UPDATE_TOOL_CALL should only receive non-terminal states
      if (!isTransientToolState(toolCall.status)) {
        throw new Error(
          `UPDATE_TOOL_CALL: Expected non-terminal status (pending, executing, permission_required), but got '${toolCall.status}'. This indicates a bug in the callback system.`,
        );
      }

      const existingCallIndex = state.toolCalls.findIndex(
        (call) => call.requestId === toolCall.requestId,
      );

      if (existingCallIndex === -1) {
        throw new Error(
          `UPDATE_TOOL_CALL: Tool call with requestId ${toolCall.requestId} not found. This indicates a bug in the tool execution logic.`,
        );
      }

      // Update tool calls (no message addition for non-terminal states)
      const updatedToolCalls = state.toolCalls.map((call) =>
        call.requestId === toolCall.requestId ? toolCall : call,
      );

      return {
        ...state,
        toolCalls: updatedToolCalls,
      };
    }

    case "COMPLETE_TOOL_CALL": {
      // ========================================================================
      // COMPLETE_TOOL_CALL - Mark Tool as Complete and Auto-Derive Message
      // ========================================================================
      //
      // This action is ONLY called when a tool reaches a terminal state.
      // It updates the tool call state AND automatically derives the tool message.
      //
      // DESIGN: Single Source of Truth for Tool State
      // - Tool call state is the primary data
      // - Tool messages are derived automatically when reaching terminal states
      // - No need for separate callback for tool messages
      //
      // FLOW:
      // 1. Executor calls onToolComplete(toolCall) with final status
      // 2. UI validates status is terminal (this action)
      // 3. UI updates toolCall in state
      // 4. UI automatically formats and adds tool message
      // 5. Both state and messages updated atomically in one action
      //
      // BENEFITS:
      // - Reduces callback complexity (no separate message callback needed)
      // - Ensures consistency (toolCall and message always in sync)
      // - Atomic updates (state + message in single reducer action)
      //
      const toolCall = action.toolCall;

      // Runtime type check: COMPLETE_TOOL_CALL should only receive terminal states
      if (!isTerminalToolState(toolCall.status)) {
        throw new Error(
          `COMPLETE_TOOL_CALL: Expected terminal status (success, error, abort, permission_denied), but got '${toolCall.status}'. This indicates a bug in the callback system.`,
        );
      }

      const existingCallIndex = state.toolCalls.findIndex(
        (call) => call.requestId === action.toolCall.requestId,
      );

      if (existingCallIndex === -1) {
        throw new Error(
          `COMPLETE_TOOL_CALL: Tool call with requestId ${action.toolCall.requestId} not found. This indicates a bug in the tool execution logic.`,
        );
      }
      // Update tool calls
      const updatedToolCalls = state.toolCalls.map((call) =>
        call.requestId === action.toolCall.requestId ? toolCall : call,
      );

      // Automatically derive and add tool message
      // Check if message already exists - this should never happen
      const messageExists = state.messages.some(
        (msg) =>
          msg.kind === "api" &&
          msg.message.role === "tool" &&
          msg.message.tool_call_id === toolCall.requestId,
      );

      if (messageExists) {
        throw new Error(
          `COMPLETE_TOOL_CALL: Tool message already exists for tool_call_id ${toolCall.requestId}. This indicates a duplicate call or bug in the tool execution logic.`,
        );
      }

      // Add the tool message
      const toolMessage = formatToolResultMessage(toolCall);
      const toolLLMMessage = wrapAsLLMMessage(toolMessage);
      const updatedMessages = [...state.messages, toolLLMMessage];

      return {
        ...state,
        toolCalls: updatedToolCalls,
        messages: updatedMessages,
      };
    }

    case "ADD_COMMAND_CALL":
      return {
        ...state,
        messages: [...state.messages, action.commandCall],
      };

    case "COMPLETE_COMMAND_CALL":
      const updatedMessages = state.messages.map((m) => {
        if (m.kind === "cmd" && m.callId === action.commandCall.callId) {
          return action.commandCall;
        }
        return m;
      });
      return {
        ...state,
        messages: updatedMessages,
      };

    case "CLEAR_SESSION":
      // Clear session but keep the last message (which should be the /clear command itself)
      // This ensures the UI shows the clear action while removing all previous conversation
      return {
        ...state,
        messages: [state.messages[state.messages.length - 1]],
        toolCalls: [],
        error: undefined,
        tokenUsage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
        clearNum: state.clearNum + 1,
      };

    case "MCP_SERVER_UPDATE":
      return {
        ...state,
        mcp: updateMCPServers(state.mcp, action),
      };

    case "UPDATE_TOKEN_USAGE":
      return {
        ...state,
        tokenUsage: action.tokenUsage,
      };

    default:
      return state;
  }
}

/**
 * Custom hook for managing App state.
 *
 * Encapsulates all state management logic for App.tsx, providing:
 * - Centralized state via useReducer
 * - Semantic action functions
 * - AbortController reference management
 *
 * @example
 * ```tsx
 * function App() {
 *   const { state, actions, abortRef } = useAppState("default");
 *
 *   const handleSubmit = async (value: string) => {
 *     const ctrl = new AbortController();
 *     actions.startRequest(ctrl);
 *     // ... fetch LLM response
 *     actions.finalize(result);
 *   };
 *
 *   return <Layout {...state} onAbort={actions.abort} />;
 * }
 * ```
 */
function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useAppState(initialApprovalMode: ApprovalMode = "default") {
  // Debug configuration - set to false to disable debug data and use normal empty state
  // When enabled, shows comprehensive tool states for UI testing
  const useDebugData = process.env.MINIKODE_DEBUG === "true";

  // Initial data - can be debug data or empty state depending on configuration
  const initialData = useDebugData
    ? createDebugAppState(false)
    : {
      messages: [],
      toolCalls: [],
    };

  /**
   * CRITICAL: Use ref to maintain stable currentApprovalMode reference across state updates
   *
   * Problem:
   * - React state updates create new state objects (immutability)
   * - ExecutionContext receives approvalMode function at time T0
   * - User changes approval mode via Shift+Tab at time T1
   * - React state updates to new state with new approvalMode value
   * - But ExecutionContext still has the old function reference from T0
   *
   * Solution:
   * - Store currentApprovalMode in useRef which is stable across renders
   * - Update ref value in reducer whenever approval mode changes
   * - getCurrentApprovalMode function reads from ref, ensuring latest value
   *
   * This ensures real-time synchronization between UI state and execution logic.
   */
  const currentApprovalModeRef = useRef<ApprovalMode>(initialApprovalMode);

  // Create reducer with access to the ref
  const reducerWithRef = (state: AppState, action: Action): AppState => {
    switch (action.type) {
      case "CYCLE_APPROVAL_MODE":
        // Cycle through approval modes: default -> autoEdit -> yolo -> default
        const cycleMode = (mode: ApprovalMode): ApprovalMode => {
          switch (mode) {
            case "default":
              return "autoEdit";
            case "autoEdit":
              return "yolo";
            case "yolo":
              return "default";
            default:
              return "default";
          }
        };
        const newApprovalMode = cycleMode(state.currentApprovalMode);
        // Update ref to ensure real-time synchronization with execution context
        currentApprovalModeRef.current = newApprovalMode;
        return {
          ...state,
          currentApprovalMode: newApprovalMode,
        };
      default:
        return reducer(state, action);
    }
  };

  const [state, dispatch] = useReducer(reducerWithRef, {
    isLLMGenerating: false,
    sessionId: randomId("session"),
    messages: initialData.messages,
    toolCalls: initialData.toolCalls,
    currentApprovalMode: initialApprovalMode,
    promptToExecute: undefined,
    tokenUsage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
    clearNum: 0,
    mcp: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  /**
   * CRITICAL: Use ref to maintain stable Map reference across state updates
   *
   * Problem:
   * - React reducer creates new Map instances on every state update (immutability)
   * - Tool execution (executeToolWithPermission) receives Map reference at time T0
   * - Tool calls requestUserApproval() and adds approval promise to Map at T0
   * - Meanwhile, React state updates create new Map instance at T1
   * - User presses return key, calls resolveApproval() with Map at T1 (empty!)
   * - Result: Promise not found, resolved=false, tool execution fails
   *
   * Solution:
   * - Store Map in useRef instead of state (ref is stable, never recreated)
   * - requestUserApproval adds to ref Map
   * - resolveApproval reads from same ref Map
   * - Both operations use the same Map instance regardless of state updates
   *
   * Trade-off:
   * - Map changes don't trigger re-renders (but we don't need them to)
   * - UI updates are driven by React state updates instead
   *
   * @see executeToolWithPermission - receives this Map and waits for approval
   * @see requestUserApproval - adds approval promise to this Map
   * @see resolveApproval - resolves promise from this Map
   */
  const pendingApprovalsRef = useRef<Map<string, ApprovalPromise>>(new Map());

  /**
   * Get the current approval mode with real-time synchronization.
   * This function reads from the ref, ensuring it always returns the latest value
   * even when React state updates occur during execution.
   */
  const getCurrentApprovalMode = useCallback((): ApprovalMode => {
    return currentApprovalModeRef.current;
  }, []);

  // Semantic action functions for common operations
  const actions = {
    /**
     * Execute a prompt through the agent loop.
     */
    executePrompt: useCallback((prompt: string) => {
      dispatch({ type: "EXECUTE_PROMPT", prompt });
    }, []),

    /**
     * Create and register an abort controller.
     * Returns the abort controller that can be used by commands or LLM requests.
     */
    createAbortController: useCallback(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      // Clear pending approvals for new request
      pendingApprovalsRef.current.clear();
      return controller;
    }, []),

    /**
     * Start a new LLM request.
     * Adds user message to history and marks the app as in-flight.
     * Assumes abort controller has already been created via createAbortController.
     */
    startRequest: useCallback((userMessage: string) => {
      // Clear pending approvals for new request
      pendingApprovalsRef.current.clear();
      dispatch({ type: "START_REQUEST", userMessage });
    }, []),

    /**
     * Update LLM message (handles both streaming and completion).
     */
    updateLLMMessage: useCallback((message: LLMMessage) => {
      const content =
        typeof message.message.content === "string"
          ? message.message.content
          : "";

      if (message.status === "streaming") {
        // Streaming update
        dispatch({ type: "UPDATE_STREAMING_MESSAGE", content });
      } else {
        // Final completion (complete or error)
        dispatch({ type: "COMPLETE_LLM_MESSAGE", message });
      }
    }, []),

    /**
     * Abort the current request.
     * Signals the AbortController and marks the app as not in-flight.
     */
    abort: useCallback(() => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    }, []),

    /**
     * Set LLM generating state.
     */
    setLLMGenerating: useCallback((isLLMGenerating: boolean) => {
      dispatch({ type: "SET_GENERATING", isLLMGenerating });
    }, []),

    /**
     * Set error message to display to user.
     */
    setError: useCallback((error?: string) => {
      dispatch({ type: "SET_ERROR", error });
    }, []),

    /**
     * Add a new tool call to session.
     *
     * Note: This does NOT add a message to the conversation.
     * Tool messages are only added when the tool completes (via completeToolCall).
     */
    addToolCall: useCallback((toolCall: ToolCallRunning) => {
      dispatch({ type: "ADD_TOOL_CALL", toolCall });
    }, []),

    /**
     * Update a tool call with non-terminal state changes.
     *
     * Use this for intermediate state updates that don't complete the tool:
     * - Status changes (e.g., pending → executing after permission granted)
     * - Progress updates
     * - Any non-terminal state transition
     *
     * This does NOT add a message to the conversation.
     * Use completeToolCall for terminal states (success/error/abort/permission_denied).
     */
    updateToolCall: useCallback((toolCall: ToolCallNonTerminal) => {
      dispatch({ type: "UPDATE_TOOL_CALL", toolCall });
    }, []),

    /**
     * Mark a tool call as complete and auto-derive its message.
     *
     * Called when a tool reaches a terminal state (success/error/abort/permission_denied).
     * Automatically derives and adds the tool message to the conversation.
     *
     * This ensures:
     * - Tool state and messages are always in sync
     * - Atomic updates (toolCall + message in single action)
     * - No duplicate messages (checks before adding)
     *
     * Flow:
     * 1. Executor calls onToolComplete(toolCall) with terminal status
     * 2. This method updates toolCall state
     * 3. Auto-format and add tool message
     * 4. Both toolCall and message updated atomically
     */
    completeToolCall: useCallback((toolCall: ToolCallTerminal) => {
      dispatch({ type: "COMPLETE_TOOL_CALL", toolCall });
    }, []),

    /**
     * Cycle to the next approval mode (default -> autoEdit -> yolo -> default).
     * Used for Shift+Tab keyboard shortcut.
     */
    cycleApprovalMode: useCallback(() => {
      dispatch({ type: "CYCLE_APPROVAL_MODE" });
    }, []),

    addCommandCall: useCallback((commandCall: CommandCall) => {
      dispatch({
        type: "ADD_COMMAND_CALL",
        commandCall: commandCall,
      });
    }, []),

    completeCommandCall: useCallback((commandCall: CommandCall) => {
      dispatch({
        type: "COMPLETE_COMMAND_CALL",
        commandCall: commandCall,
      });
    }, []),

    /**
     * Update MCP server status
     */
    updateMCPServer: useCallback((status: MCPServerState) => {
      dispatch({
        type: "MCP_SERVER_UPDATE",
        payload: status,
      });
    }, []),

    /**
     * Clear the current session.
     * Used for /clear command.
     */
    clearSession: useCallback(() => {
      dispatch({ type: "CLEAR_SESSION" });
    }, []),

    /**
     * Update token usage for the current session.
     */
    updateTokenUsage: useCallback((tokenUsage: TokenUsage) => {
      dispatch({ type: "UPDATE_TOKEN_USAGE", tokenUsage });
    }, []),
  };

  // Helper to build Session object for executor with token usage
  const buildSession = useCallback(() => {
    // Extract all LLM messages from UI messages
    const allLLMMessages = state.messages.filter(
      (m): m is LLMMessage => m.kind === "api",
    );

    // Find the last successful /compact command
    let lastCompactCommand: CommandCall<"/compact"> | undefined;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const msg = state.messages[i];
      if (
        msg.kind === "cmd" &&
        msg.commandName === "/compact" &&
        msg.status === "success"
      ) {
        lastCompactCommand = msg as CommandCall<"/compact">;
        break;
      }
    }

    // If no compact command exists, return all LLM messages
    if (!lastCompactCommand) {
      return {
        sessionId: state.sessionId,
        messages: allLLMMessages,
        toolCalls: state.toolCalls,
        tokenUsage: state.tokenUsage,
      };
    }

    // Convert compact command result to a user message for LLM context
    const compactSummaryMessage: LLMMessage = {
      kind: "api",
      status: "complete",
      message: {
        role: "user",
        content: `[Previous conversation summary]\n${lastCompactCommand.result}`,
      },
    };

    // Find all messages that came after the compact command
    const messagesAfterCompact: LLMMessage[] = [];
    const compactCommandPosition = state.messages.indexOf(lastCompactCommand);

    for (let i = compactCommandPosition + 1; i < state.messages.length; i++) {
      const msg = state.messages[i];
      if (msg.kind === "api") {
        messagesAfterCompact.push(msg);
      }
    }

    // Build final message list: compact summary + messages after compact
    const finalMessages = [compactSummaryMessage, ...messagesAfterCompact];

    return {
      sessionId: state.sessionId,
      messages: finalMessages,
      toolCalls: state.toolCalls,
      tokenUsage: state.tokenUsage,
    };
  }, [state.sessionId, state.messages, state.toolCalls, state.tokenUsage]);

  return {
    state,
    actions,
    refs: {
      pendingApprovals: pendingApprovalsRef,
      abort: abortRef,
      currentApprovalMode: currentApprovalModeRef,
    },
    getCurrentApprovalMode,
    buildSession,
  };
}

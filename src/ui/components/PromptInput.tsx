import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import { Box, Key, Text, useInput } from "ink";
import chalk from "chalk";

import { useFileCompletion } from "../hooks/useFileCompletion";
import { useDoubleKeyPress } from "../hooks/useDoubleKeyPress";
import { getCurrentTheme } from "../theme";
import { FileSelector } from "./FileSelector";
import { CommandPalette } from "./CommandPalette";
import { HelpBar } from "./HelpBar";
import { openExternalEditor } from "../utils/externalEditor";
import type { AppState, AppActions } from "../hooks/useAppState";
import { ALL_COMMANDS, CommandName, COMMANDS_BY_NAME } from "../commands";
import { calculateMentionContext } from "../../mentions/context";

/**
 * ===== PromptInput Component =====
 *
 * Features Overview:
 * - Multi-line text input: Support for long text and code blocks
 * - @mention file selection: Type @ to trigger file selector for quick file path insertion
 * - Bulk paste optimization: Handle terminal bulk pasting without data loss
 * - Basic keyboard navigation: Left/Right arrow keys for cursor movement, Backspace for deletion
 * - Essential shortcuts: ESC to exit @mention, Option+Enter for newlines, Shift+Tab for mode switching
 * - Double ESC to clear input: Quickly clear all text when agent is not executing
 *
 * Architecture Design:
 *
 * 1. Unified Input Control (No Separate TextInput):
 *    - Consolidate text input, cursor management, and @mention in a single component
 *    - Avoid complexity of inter-component state synchronization
 *    - Provide complete control and consistent interaction experience
 *
 * 2. Ref-First Architecture (Solving Bulk Paste Issues):
 *    - Problem: React async state updates cause data loss during rapid input
 *    - Solution: Use useRef as primary data source, useState only for triggering re-renders
 *    - Advantage: Synchronous data updates, avoid React batching state race conditions
 *
 * 3. Event-Driven @mention Design:
 *    - Trigger: User types @ character → setMentionMode(true)
 *    - Computation: mentionContext derived from mentionMode + refs
 *    - Exit: Complete file path, space input, ESC key, or file selection
 *    - Advantage: Clear separation of trigger vs computed state
 *
 * 4. State Management Strategy:
 *    - valueRef/cursorRef: Primary data source, synchronous updates
 *    - renderCounter: Simple counter to trigger React re-renders (minimal state overhead)
 *    - mentionMode: Simple boolean state for @mention mode (triggered by @ input)
 *    - mentionContext: Computed state (prefix, position, etc.) derived from mentionMode + refs
 *    - selectedMentionFileIndex: Selected item index in file selector
 */

export interface PromptInputProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  onExit: () => void;
  cwd: string;
  onCycleApprovalMode: () => void;
  isAgentExecuting?: boolean;
  state: AppState;
  actions: AppActions;
  onExecuteCommand: (command: CommandName) => Promise<void>;
}

export function PromptInput({
  placeholder = "Type your prompt",
  onSubmit,
  onExit,
  cwd,
  onCycleApprovalMode,
  isAgentExecuting = false,
  state,
  actions,
  onExecuteCommand,
}: PromptInputProps) {
  const [mentionMode, setMentionMode] = useState<boolean>(false);
  const [selectedMentionFileIndex, setSelectedMentionFileIndex] =
    useState<number>(0);

  const [selectedCommandIndex, setSelectedCommandIndex] = useState<number>(0);

  const [isExternalEditing, setIsExternalEditing] = useState<boolean>(false);

  const [escTips, setEscTips] = useState<string | undefined>(undefined);

  // Help mode state - triggered by ? at the beginning of input
  const [helpMode, setHelpMode] = useState<boolean>(false);

  // Timeout ref for escTips message display
  const escTipsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs are the PRIMARY source of truth for input data
  const valueRef = useRef("");
  const cursorRef = useRef(0);

  // Cleanup escTips timeout on unmount
  useEffect(() => {
    return () => {
      if (escTipsTimeoutRef.current) {
        clearTimeout(escTipsTimeoutRef.current);
        escTipsTimeoutRef.current = null;
      }
    };
  }, []);

  // Simple counter to trigger React re-renders
  const [, setRenderCounter] = useState(0);

  // Trigger re-render by incrementing counter
  const triggerRerender = useCallback(() => {
    setRenderCounter((prev) => prev + 1);
  }, []);

  // Update refs and trigger re-render
  const updateRefsAndRerender = useCallback(
    (value: string, cursor: number) => {
      // Update primary data source
      valueRef.current = value;
      cursorRef.current = cursor;

      // Trigger re-render
      triggerRerender();
    },
    [triggerRerender],
  );

  const submit = useCallback(
    (value: string) => {
      const current = value;
      const trimmed = current.trim();

      if (
        trimmed.toLowerCase() === "exit" ||
        trimmed.toLowerCase() === "quit" ||
        trimmed.toLowerCase() === "q"
      ) {
        onExit();
        return;
      }

      if (trimmed.length > 0) {
        let isCommand = false;
        // Handle commands that are typed directly (like /clear, /compact, etc.)
        if (trimmed.startsWith("/") && trimmed.length > 1) {
          // Execute command directly if it's a complete command
          const command = COMMANDS_BY_NAME[trimmed as CommandName]; // Use full command name
          if (command) {
            isCommand = true;
            onExecuteCommand(trimmed as CommandName);
          }
        }
        if (!isCommand) {
          onSubmit(trimmed);
        }
        updateRefsAndRerender("", 0);
      }
    },
    [onExit, onSubmit, updateRefsAndRerender, actions, onExecuteCommand],
  );

  // Handle external editor
  const handleExternalEditor = useCallback(async () => {
    if (isExternalEditing) return;

    setIsExternalEditing(true);

    try {
      const result = await openExternalEditor({
        content: valueRef.current,
      });

      if (result.success && result.content !== undefined) {
        // Check if agent is currently executing
        if (isAgentExecuting) {
          // Agent is running, save content to input and place cursor at the end
          updateRefsAndRerender(result.content, result.content.length);
        } else {
          // Agent is not running, submit the edited content directly
          updateRefsAndRerender("", 0);
          submit(result.content);
        }
      } else {
        // Show error message using AppState error
        actions.setError(
          `External editor error: ${result.error || "unknown error"}`,
        );
      }
    } catch (error) {
      actions.setError(
        `External editor error: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setIsExternalEditing(false);
    }
  }, [
    isExternalEditing,
    isAgentExecuting,
    updateRefsAndRerender,
    submit,
    actions,
  ]);

  const handleClearInput = useCallback(() => {
    updateRefsAndRerender("", 0);
  }, [updateRefsAndRerender, mentionMode]);

  // Use double key press hook for ESC key
  useDoubleKeyPress((_, key) => key.escape, {
    windowMs: 500,
    onDoublePress: handleClearInput,
    enabled: !isAgentExecuting, // Only enable double ESC when agent is not executing
  });

  // Handle double Ctrl+C to exit
  useDoubleKeyPress((input, key) => key.ctrl && input === "c", {
    windowMs: 1000,
    onFirstPress: () => {
      // Show escTips message on first Ctrl+C press
      setEscTips("press ctrl+c again to exit");

      // Clear any existing timeout
      if (escTipsTimeoutRef.current) clearTimeout(escTipsTimeoutRef.current);

      // Auto-hide escTips message after 1 seconds
      escTipsTimeoutRef.current = setTimeout(() => {
        setEscTips(undefined);
        escTipsTimeoutRef.current = null;
      }, 1000);
    },
    onDoublePress: () => {
      // Exit on double Ctrl+C
      onExit();
    },
  });

  // @mention context calculation using refs
  const mentionContext = useMemo(() => {
    return calculateMentionContext(
      valueRef.current,
      cursorRef.current,
      mentionMode,
    );
  }, [valueRef.current, cursorRef.current, mentionMode]);

  // Filter commands based on input value
  const filteredCommands = useMemo(() => {
    const value = valueRef.current;

    // Only show command palette if input starts with / and cursor is at or after /
    if (!value.startsWith("/") || cursorRef.current < 1) {
      return [];
    }

    const query = value.slice(1, cursorRef.current).toLowerCase();

    return ALL_COMMANDS.filter(
      (command) =>
        command.name.toLowerCase().includes(query) ||
        command.description.toLowerCase().includes(query),
    );
  }, [valueRef.current, cursorRef.current]);

  // Determine if command palette should be shown
  const shouldShowCommandPalette = filteredCommands.length > 0;

  // Handle command selection
  const handleCommandSelect = useCallback(
    (commandIndex: number) => {
      if (isAgentExecuting) {
        return;
      }

      if (commandIndex < 0 || commandIndex >= filteredCommands.length) {
        return;
      }

      const selectedCommand = filteredCommands[commandIndex];

      // Execute the command
      if (onExecuteCommand) {
        onExecuteCommand(selectedCommand.name);
      }

      // Clear input and exit command mode
      updateRefsAndRerender("", 0);
      setSelectedCommandIndex(0);
    },
    [
      actions,
      updateRefsAndRerender,
      onExecuteCommand,
      filteredCommands,
      isAgentExecuting,
    ],
  );

  // Reset selected index when mention prefix changes
  useEffect(() => {
    setSelectedMentionFileIndex(0);
  }, [mentionContext?.prefix]);

  // Use file completion hook
  const completion = useFileCompletion({
    cwd,
    query: mentionContext?.prefix || "",
    enabled: !!mentionContext,
  });

  // Show both files and directories for selection
  const allSuggestions = completion.suggestions;

  // Show file selector when there are suggestions
  const shouldShowSelector = mentionContext && allSuggestions.length > 0;

  /**
   * Handle file/directory selection from @mention autocomplete
   *
   * Replaces partial @mention with complete path and positions cursor correctly.
   * Directory paths already include trailing slash from useFileCompletion.
   */
  const handleFileSelect = useCallback(
    (selectedMentionFileIndex: number) => {
      if (
        !mentionContext ||
        selectedMentionFileIndex < 0 ||
        selectedMentionFileIndex >= allSuggestions.length
      )
        return;

      const selectedSuggestion = allSuggestions[selectedMentionFileIndex];
      const selectedPath = selectedSuggestion.path;

      // Replace the @mention with the selected path
      // Use REFS for consistency with ref-first architecture
      const before = valueRef.current.slice(0, mentionContext.start);
      const after = valueRef.current.slice(cursorRef.current);

      // Add quotes if path contains spaces
      const pathWithQuotes = selectedPath.includes(" ")
        ? `"${selectedPath}"`
        : selectedPath;

      const newBuffer = `${before}@${pathWithQuotes} ${after}`;

      // Calculate new cursor position: before + @ + path + space
      const newCursorPos = before.length + 1 + pathWithQuotes.length + 1;

      updateRefsAndRerender(newBuffer, newCursorPos);

      // Exit mention mode after file selection
      setMentionMode(false);
      setSelectedMentionFileIndex(0);
    },
    [mentionContext, allSuggestions, setMentionMode, updateRefsAndRerender],
  );

  // Text rendering logic - use REFS as primary data source
  const renderText = () => {
    const value = valueRef.current;
    const cursorPosition = cursorRef.current;

    let renderedValue = value;
    let renderedPlaceholder = undefined;

    if (value.length === 0 && placeholder) {
      // Show placeholder with cursor
      renderedPlaceholder =
        chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1));
    } else if (value.length > 0) {
      // Show value with cursor
      renderedValue = "";
      for (let i = 0; i < value.length; i++) {
        if (i === cursorPosition && value[i] !== "\n") {
          renderedValue += chalk.inverse(value[i]);
        } else {
          renderedValue += value[i];
        }
      }

      // Show cursor at end if no more characters
      if (cursorPosition >= value.length) {
        renderedValue += chalk.inverse(" ");
      }
    }

    const finalResult = renderedPlaceholder || renderedValue;
    return finalResult;
  };

  /**
   * Handle all input directly - no TextInput component needed!
   */
  useInput(
    (input, key) => {
      // Handle command palette navigation when active
      if (shouldShowCommandPalette) {
        if (key.upArrow) {
          setSelectedCommandIndex((prev) => Math.max(0, prev - 1));
          return;
        } else if (key.downArrow) {
          setSelectedCommandIndex((prev) =>
            Math.min(filteredCommands.length - 1, prev + 1),
          );
          return;
        } else if (key.return) {
          handleCommandSelect(selectedCommandIndex);
          return;
        }
      }

      // Handle file selector navigation when selector is active
      if (shouldShowSelector) {
        if (key.upArrow) {
          setSelectedMentionFileIndex((prev) => Math.max(0, prev - 1));
          return;
        } else if (key.downArrow) {
          setSelectedMentionFileIndex((prev) =>
            Math.min(allSuggestions.length - 1, prev + 1),
          );
          return;
        } else if (key.return && allSuggestions[selectedMentionFileIndex]) {
          handleFileSelect(selectedMentionFileIndex);
          return;
        } else if (key.escape) {
          // Exit command palette mode
          setMentionMode(false);
          setSelectedMentionFileIndex(0);
          return;
        }
      }

      // Handle ESC key to exit help mode
      if (helpMode && key.escape) {
        setHelpMode(false);
        return;
      }

      // Handle Shift+Tab for approval mode cycling
      if (key.shift && key.tab) {
        onCycleApprovalMode();
        return;
      }

      // Handle text input, navigation, and submission
      processInput(input, key);
    },
    { isActive: true },
  );

  /**
   * Process all text input, navigation, and editing
   * Simple refs-based approach - no dual-state complexity!
   */
  const processInput = useCallback(
    (input: string, key: Key) => {
      // Use refs for rapid accumulation during paste
      const currentValue = valueRef.current;
      const currentCursor = cursorRef.current;

      // Handle special keys
      if (key.meta && key.return) {
        // Option+Enter: Insert newline
        const nextValue =
          currentValue.slice(0, currentCursor) +
          "\n" +
          currentValue.slice(currentCursor);
        updateRefsAndRerender(nextValue, currentCursor + 1);
        return;
      }

      // Handle Ctrl+E for external editor - check for actual Ctrl+E character
      // Ctrl+E is ASCII code 5 (ENQ character)
      if (
        input.charCodeAt(0) === 5 ||
        (key.ctrl && (input === "e" || input === "E"))
      ) {
        handleExternalEditor();
        return;
      }

      if (key.return) {
        // Enter: Submit
        if (!isAgentExecuting) {
          submit(currentValue);
        }
        return;
      }

      // Handle all Ctrl key combinations - ignore them completely except Ctrl+E and Ctrl+A
      if (
        key.ctrl &&
        input !== "e" &&
        input !== "E" &&
        input !== "a" &&
        input !== "A"
      ) {
        return;
      }

      // Handle cursor navigation
      let nextCursor = currentCursor;
      let nextValue = currentValue;

      if (key.leftArrow) {
        nextCursor = Math.max(0, currentCursor - 1);
      } else if (key.rightArrow) {
        nextCursor = Math.min(currentValue.length, currentCursor + 1);
      } else if (key.backspace || key.delete) {
        if (currentCursor > 0) {
          nextValue =
            currentValue.slice(0, currentCursor - 1) +
            currentValue.slice(currentCursor);
          nextCursor = currentCursor - 1;
        }
      } else {
        // Text input (including paste chunks)
        const normalizedInput = input
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n");

        // Clear any existing errors when user starts typing
        actions.setError(undefined);

        // Check for ? at the beginning of input to trigger help mode
        if (
          normalizedInput === "?" &&
          currentValue.length === 0 &&
          currentCursor === 0
        ) {
          // Activate help mode and don't add ? to the input
          setHelpMode((m) => !m);
          return;
        }

        // Check for @ input to trigger mention mode
        if (normalizedInput === "@") {
          setMentionMode(true);
        }

        nextValue =
          currentValue.slice(0, currentCursor) +
          normalizedInput +
          currentValue.slice(currentCursor);
        nextCursor = currentCursor + normalizedInput.length;
      }

      // Update state if anything changed
      if (nextValue !== currentValue || nextCursor !== currentCursor) {
        updateRefsAndRerender(nextValue, nextCursor);
      }
    },
    [
      shouldShowSelector,
      submit,
      updateRefsAndRerender,
      handleExternalEditor,
      actions.setError,
      isAgentExecuting,
    ],
  );

  return (
    <Box width="100%" flexDirection="column">
      {/* Input box */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={getCurrentTheme().secondary}
        paddingX={1}
        paddingY={0}
      >
        <Box flexDirection="column" width="100%">
          {renderText()
            .split("\n")
            .map((line: string, idx: number) => {
              // Render empty lines: Text component doesn't render empty strings by default, need to explicitly render a space
              if (line.length === 0) {
                return <Text key={idx}> </Text>;
              }
              return <Text key={idx}>{line}</Text>;
            })}
        </Box>
      </Box>

      {/* File selector dropdown - below the input */}
      {shouldShowSelector && (
        <FileSelector
          suggestions={allSuggestions}
          selectedIndex={selectedMentionFileIndex}
        />
      )}

      {/* Command palette */}
      {shouldShowCommandPalette && (
        <CommandPalette
          selectedIndex={selectedCommandIndex}
          commands={filteredCommands}
        />
      )}

      {!shouldShowCommandPalette && !shouldShowSelector && (
        <HelpBar
          approvalMode={state.currentApprovalMode}
          helpMode={helpMode}
          mcp={state.mcp}
          message={escTips}
          tokenUsage={state.tokenUsage}
        />
      )}
    </Box>
  );
}

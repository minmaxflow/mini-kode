import path from "path";

import { useState } from "react";
import { Box, Text, useInput } from "ink";

import type {
  PermissionOption,
  PermissionUiHint,
} from "../../permissions/types";
import { extractCommandPrefix } from "../../permissions";
import { getCurrentTheme } from "../theme";

export interface PermissionSelectorProps {
  uiHint: PermissionUiHint;
  onDecide: (option: PermissionOption) => void;
  cwd: string;
}

interface OptionItem {
  value: PermissionOption;
  label: string;
}

export function PermissionSelector({
  uiHint,
  onDecide,
  cwd,
}: PermissionSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build options based on permission type
  const options = buildOptions(uiHint);

  // Handle keyboard input for permission selection
  // When this component is shown, PromptInput is not rendered
  // so there are no input conflicts with useInput
  useInput((_, key) => {
    // Arrow key navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < options.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      // Enter key to confirm selection
      onDecide(options[selectedIndex].value);
    } else if (key.escape) {
      // Escape key to reject
      onDecide({ kind: "reject" });
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={getCurrentTheme().warning}
      paddingX={1}
    >
      <Text color={getCurrentTheme().warning} bold>
        Permission required
      </Text>
      <Text dimColor>
        Options marked "remember" are saved for future sessions
      </Text>
      <Box marginTop={1}>{renderUiHintDetails(uiHint, cwd)}</Box>
      <Box marginTop={1}>
        <Text>Do you want to proceed?</Text>
      </Box>

      {options.map((opt, i) => (
        <Box key={i} flexDirection="row">
          <Text
            color={i === selectedIndex ? getCurrentTheme().accent : undefined}
          >
            {i === selectedIndex ? "> " : "  "}
            {i + 1}. {opt.label}
          </Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>
          Use arrow keys to select, Enter to confirm, Esc to reject
        </Text>
      </Box>
    </Box>
  );
}

function getRelativePath(absolutePath: string, cwd: string): string {
  const rel = path.relative(cwd, absolutePath);
  return rel;
}

function buildOptions(uiHint: PermissionSelectorProps["uiHint"]): OptionItem[] {
  if (uiHint.kind === "bash") {
    const cmdPrefix = extractCommandPrefix(uiHint.command);

    return [
      {
        value: { kind: "once" },
        label: "Yes (only this time)",
      },
      {
        value: { kind: "bash", scope: "prefix" },
        label: `Yes, remember for ${cmdPrefix} commands`,
      },
      {
        value: { kind: "bash", scope: "global" },
        label: `Yes, remember for all bash commands`,
      },
      {
        value: { kind: "reject" },
        label: "No (esc)",
      },
    ];
  }

  if (uiHint.kind === "mcp") {
    return [
      {
        value: { kind: "once" },
        label: "Yes (only this time)",
      },
      {
        value: { kind: "mcp", scope: "tool" },
        label: `Yes, remember for ${uiHint.displayName}`,
      },
      {
        value: { kind: "mcp", scope: "server" },
        label: `Yes, remember for ${uiHint.serverName} server`,
      },
      {
        value: { kind: "reject" },
        label: "No (esc)",
      },
    ];
  }

  // Default to FS permissions
  const filePath = uiHint.path;
  const dirPath = path.dirname(filePath);

  return [
    {
      value: { kind: "once" },
      label: "Yes (only this time)",
    },
    {
      value: { kind: "fs", scope: "directory" },
      label: `Yes, remember for ${path.basename(dirPath)}/`,
    },
    {
      value: { kind: "fs", scope: "global" },
      label: `Yes, remember for all files`,
    },
    {
      value: { kind: "reject" },
      label: "No (esc)",
    },
  ];
}

function renderUiHintDetails(uiHint: PermissionUiHint, cwd: string) {
  if (uiHint.kind === "bash") {
    return (
      <Box flexDirection="column">
        <Text>Bash command</Text>
        <Box marginTop={1} marginLeft={2}>
          <Text color="cyan">{uiHint.command}</Text>
        </Box>
        {uiHint.message && (
          <Box marginTop={1} marginLeft={2}>
            <Text dimColor>{uiHint.message}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (uiHint.kind === "fs") {
    const displayPath = getRelativePath(uiHint.path, cwd);
    return (
      <Box flexDirection="column">
        <Text>WRITE grant needed for:</Text>
        <Box marginTop={1} marginLeft={2}>
          <Text color={getCurrentTheme().warning}>{displayPath}</Text>
        </Box>
        {uiHint.message && (
          <Box marginLeft={2}>
            <Text dimColor>{uiHint.message}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (uiHint.kind === "mcp") {
    return (
      <Box flexDirection="column">
        <Text>MCP Tool access needed for:</Text>
        <Box marginTop={1} marginLeft={2}>
          <Text color={getCurrentTheme().warning}>{uiHint.displayName}</Text>
        </Box>
        {uiHint.message && (
          <Box marginLeft={2}>
            <Text dimColor>{uiHint.message}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return null;
}

export default PermissionSelector;

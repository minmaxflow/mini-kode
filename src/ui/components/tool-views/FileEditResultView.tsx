import { Box, Text } from "ink";
import { structuredPatch } from "diff";
import path from "path";
import { useTerminalWidth } from "../../hooks/useTerminalWidth";
import { getCurrentTheme } from "../../theme";
import { FileEditSuccessType } from "../../../tools";
import type { ToolCall } from "../../../tools/runner.types";

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function calculateDiff(
  editStartLine: number,
  newContent: string,
  oldContent?: string,
): DiffLine[] {
  if (!oldContent || oldContent === "") {
    // For new files, all lines are added
    return newContent.split("\n").map((content, index) => ({
      type: "added" as const,
      content,
      newLineNumber: editStartLine + index,
    }));
  }

  // For update operations, calculate diff between old_string and new_string
  return calculateFullDiff(editStartLine, newContent, oldContent);
}

function calculateFullDiff(
  editStartLine: number,
  newContent: string,
  oldContent: string,
): DiffLine[] {
  const patch = structuredPatch("", "", oldContent, newContent, "", "");
  const result: DiffLine[] = [];
  const baseLine = editStartLine;

  for (const hunk of patch.hunks) {
    // Adjust line numbers based on editStartLine
    let oldLineNum = hunk.oldStart + baseLine - 1;
    let newLineNum = hunk.newStart + baseLine - 1;

    for (const line of hunk.lines) {
      const lineType = line[0];

      if (lineType === " ") {
        result.push({
          type: "unchanged",
          content: line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      } else if (lineType === "+") {
        result.push({
          type: "added",
          content: line,
          newLineNumber: newLineNum++,
        });
      } else if (lineType === "-") {
        result.push({
          type: "removed",
          content: line,
          oldLineNumber: oldLineNum++,
        });
      }
    }
  }

  return result;
}

function calculateDiffStats(diffLines: DiffLine[]) {
  const added = diffLines.filter((line) => line.type === "added").length;
  const removed = diffLines.filter((line) => line.type === "removed").length;

  // Calculate max line numbers for width calculations
  const maxOldLineNumber = Math.max(
    ...diffLines.map((line) => line.oldLineNumber || 0),
    1,
  );
  const maxNewLineNumber = Math.max(
    ...diffLines.map((line) => line.newLineNumber || 0),
    1,
  );

  return {
    added,
    removed,
    maxOldLineNumber,
    maxNewLineNumber,
  };
}

interface DiffHeaderProps {
  cwd: string;
  filePath: string;
  added: number;
  removed: number;
  action: "Update" | "Create";
}

function DiffHeader({
  filePath,
  added,
  removed,
  action,
  cwd,
}: DiffHeaderProps) {
  const relativePath = path.relative(cwd, filePath);

  if (added === 0 && removed === 0) {
    return <Text>no changes</Text>;
  }

  const getChangeText = () => {
    if (added > 0 && removed > 0) {
      const additionText = added === 1 ? "addition" : "additions";
      const removalText = removed === 1 ? "removal" : "removals";
      return (
        <>
          with <Text bold>{added}</Text> {additionText} and{" "}
          <Text bold>{removed}</Text> {removalText}
        </>
      );
    } else if (added > 0) {
      const additionText = added === 1 ? "addition" : "additions";
      return (
        <>
          with <Text bold>{added}</Text> {additionText}
        </>
      );
    } else {
      const removalText = removed === 1 ? "removal" : "removals";
      return (
        <>
          with <Text bold>{removed}</Text> {removalText}
        </>
      );
    }
  };

  return (
    <Text>
      {action}(<Text bold>{relativePath}</Text>) {getChangeText()}
    </Text>
  );
}

export function FileEditResultView({
  result,
  cwd,
  toolCall,
}: {
  result: FileEditSuccessType;
  cwd: string;
  toolCall: ToolCall;
}) {
  // Get content from input instead of result
  const oldContent = toolCall.input.old_string as string || "";
  const newContent = toolCall.input.new_string as string || "";
  
  const diffLines = calculateDiff(
    result.editStartLine,
    newContent,
    oldContent,
  );
  const stats = calculateDiffStats(diffLines);

  const hasChanges = diffLines.some((line) => line.type !== "unchanged");
  const terminalWidth = useTerminalWidth();

  // Calculate dynamic line number widths using stats
  const oldLineNumberWidth = Math.max(
    2,
    stats.maxOldLineNumber.toString().length,
  );
  const newLineNumberWidth = Math.max(
    2,
    stats.maxNewLineNumber.toString().length,
  );

  return (
    <Box flexDirection="column">
      <DiffHeader
        cwd={cwd}
        filePath={result.filePath}
        added={stats.added}
        removed={stats.removed}
        action={oldContent ? "Update" : "Create"}
      />
      {hasChanges ? (
        <Box flexDirection="column">
          {diffLines.map((line, index) => {
            const lineBgColor =
              line.type === "added"
                ? getCurrentTheme().diff.added
                : line.type === "removed"
                  ? getCurrentTheme().diff.removed
                  : undefined;

            // Two-column line numbering: old | new
            const oldLineNumber =
              line.oldLineNumber
                ?.toString()
                .padStart(oldLineNumberWidth, " ") ||
              " ".repeat(oldLineNumberWidth);
            const newLineNumber =
              line.newLineNumber
                ?.toString()
                .padStart(newLineNumberWidth, " ") ||
              " ".repeat(newLineNumberWidth);

            return (
              <Box key={index} flexDirection="row" width="100%" gap={1}>
                <Box width={oldLineNumberWidth}>
                  <Text>{oldLineNumber}</Text>
                </Box>
                <Box width={newLineNumberWidth}>
                  <Text>{newLineNumber}</Text>
                </Box>
                {/* 9 = 6 (parent UI left margin) + 2 (two gaps) + 1 (required buffer) */}
                <Box
                  width={
                    terminalWidth - oldLineNumberWidth - newLineNumberWidth - 9
                  }
                  backgroundColor={lineBgColor}
                >
                  <Text>{line.content}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}

export default FileEditResultView;

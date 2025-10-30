/**
 * FileSelector component - Autocomplete dropdown for @mention file/directory selection
 *
 * This component displays a list of file and directory suggestions and handles keyboard
 * navigation (up/down arrows, enter to select, escape to close).
 *
 * Features:
 * - Shows both files (📄) and directories (📁) with appropriate icons
 * - Displays file sizes for files only
 * - Supports directory selection with trailing slash for continued navigation
 */

import { Box, Text } from "ink";

import { FileEntry } from "../../mentions/types";
import { getCurrentTheme } from "../theme";

export interface FileSelectorProps {
  /**
   * Array of fuzzy-matched file suggestions
   */
  suggestions: FileEntry[];

  /**
   * Currently selected index (for keyboard navigation)
   */
  selectedIndex: number;

  /**
   * Maximum number of items to display
   * @default 10
   */
  maxDisplay?: number;
}

/**
 * FileSelector component
 *
 * @example
 * ```tsx
 * <FileSelector
 *   suggestions={completionResults}
 *   selectedIndex={0}
 *   onSelect={(index) => selectFile(index)}
 *   onClose={() => setShowSelector(false)}
 * />
 * ```
 */
export function FileSelector({
  suggestions,
  selectedIndex,
  maxDisplay = 10,
}: FileSelectorProps) {
  // Limit displayed items for performance
  const displayItems = suggestions.slice(0, maxDisplay);

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* File list */}
      {displayItems.map((entry, index) => {
        const isSelected = index === selectedIndex;
        const { path, type } = entry;

        // Choose appropriate icon based on type
        const icon = type === "directory" ? "📁" : "📄";

        return (
          <Box key={path}>
            <Text
              color={
                !isSelected
                  ? getCurrentTheme().secondary
                  : getCurrentTheme().accent
              }
            >
              {path}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

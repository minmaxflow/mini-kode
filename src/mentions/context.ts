/**
 * Calculate @mention context from input text and cursor position
 * Returns null if not in mention mode or if mention is complete
 *
 * Example:
 *
 * Typical active mention scenario:
 *   value = "help @src/utils"
 *   cursor = 15
 *   Result: { prefix: "src/utils", start: 5 }
 *
 *   If mentionText ends with file extension or contains whitespace,
 *   function returns null to exit mention mode.
 */
export function calculateMentionContext(
  value: string,
  cursor: number,
  isInMentionMode: boolean,
): { prefix: string; start: number } | null {
  if (!isInMentionMode) return null;

  // Find the @ symbol before or at cursor position
  // value.lastIndexOf("@", cursor) searches for @ symbol up to cursor position
  const atSymbolAtIndex = value.lastIndexOf("@", cursor);

  if (atSymbolAtIndex === -1) return null;

  // Return null if cursor is exactly at @ symbol position
  // This provides better UX by not showing file selector until user types at least one character after @
  if (atSymbolAtIndex === cursor) return null;

  // Extract the mention text after @ symbol up to cursor position
  // Using slice() instead of substring() to avoid parameter swapping behavior
  const mentionText = value.slice(atSymbolAtIndex + 1, cursor);

  // Exit mention mode for complete files or whitespace
  // This provides automatic exit when user finishes typing a file path
  const commonExtensions =
    /\.(ts|js|tsx|jsx|json|md|txt|py|java|cpp|c|h|go|rs|rb|php|sh|yml|yaml|toml|lock|css|scss|less|html|xml|sql|gitignore|eslintrc|prettierrc|editorconfig)$/;
  if (commonExtensions.test(mentionText) || /\s/.test(mentionText)) {
    return null;
  }

  return {
    prefix: mentionText,
    start: atSymbolAtIndex,
  };
}

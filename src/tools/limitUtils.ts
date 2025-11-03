/**
 * Text limiting utilities
 * Used to limit text output to avoid exhausting LLM context window
 */

export interface TextLimitConfig {
  offset?: number;
  maxLines?: number;
  maxLineLength?: number;
  truncateIndicator?: string;
}

/**
 * Limit text by offset, number of lines and line length
 * @param text Original text
 * @param config Limit configuration
 * @returns Processed text and truncation info
 */
export function limitText(
  text: string,
  config: TextLimitConfig = {},
): {
  content: string;
  truncated: boolean;
  fileTotalLines: number;
  actualOffset: number;
  actualLimit: number;
} {
  const {
    offset = 0,
    maxLines = 2000,
    maxLineLength = 2000,
    truncateIndicator = "... [truncated]",
  } = config;

  const lines = text.split(/\r\n|\r|\n/);
  const fileTotalLines = lines.length;

  const actualOffset = Math.min(offset, fileTotalLines);
  const linesAfterOffset = lines.slice(actualOffset);

  // Limit number of lines
  const limitedLines = linesAfterOffset.slice(0, maxLines);
  const actualLimit = limitedLines.length;

  // Limit line length using limitString
  const processedLines = limitedLines.map(
    (line) => limitString(line, maxLineLength, truncateIndicator).content,
  );

  const content = processedLines.join("\n");
  // truncated: whether there are more lines beyond maxLines limit
  const truncated = linesAfterOffset.length > maxLines;

  return { content, truncated, fileTotalLines, actualOffset, actualLimit };
}

/**
 * Limit string length
 * @param text Original string
 * @param maxLength Maximum length
 * @param truncateIndicator Truncation indicator
 * @returns Processed string and truncation info
 */
export function limitString(
  text: string,
  maxLength: number,
  truncateIndicator: string = "... [truncated]",
): { content: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { content: text, truncated: false };
  }

  const content = text.slice(0, maxLength) + truncateIndicator;
  return { content, truncated: true };
}

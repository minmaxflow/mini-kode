/**
 * React hook for file autocomplete with fuzzy search
 *
 * This hook integrates file scanning and fuzzy matching to provide
 * autocomplete suggestions for @mention file paths.
 */

import { useEffect, useMemo, useState } from "react";

import { fuzzyMatch } from "../../mentions/fuzzyMatcher";
import { fileScanner } from "../../mentions/scanner";
import { FileEntry } from "../../mentions/types";

export interface UseFileCompletionOptions {
  /**
   * Current working directory to scan files from
   */
  cwd: string;

  /**
   * Current search query (e.g., the text after @ symbol)
   */
  query: string;

  /**
   * Whether the autocomplete is active (e.g., cursor is in a mention)
   */
  enabled: boolean;

  /**
   * Maximum number of suggestions to return
   * @default 20
   */
  maxResults?: number;
}

export interface UseFileCompletionResult {
  /**
   * Array of matched file entries sorted by relevance
   */
  suggestions: FileEntry[];

  /**
   * Whether files are currently being scanned
   */
  isLoading: boolean;

  /**
   * Error message if scanning failed
   */
  error: string | null;

  /**
   * Total number of files available in the project
   */
  totalFiles: number;

  /**
   * Manually trigger a rescan (e.g., when files change)
   */
  refresh: () => void;
}

/**
 * Hook for file autocomplete with fuzzy search
 *
 * @example
 * ```tsx
 * function PromptInput() {
 *   const [input, setInput] = useState('');
 *   const [cursorPos, setCursorPos] = useState(0);
 *
 *   const mention = detectMentionAtCursor(input, cursorPos);
 *
 *   const completion = useFileCompletion({
 *     cwd: process.cwd(),
 *     query: mention?.prefix || '',
 *     enabled: mention?.isInMention || false,
 *   });
 *
 *   if (completion.suggestions.length > 0) {
 *     return <FileSelector suggestions={completion.suggestions} />;
 *   }
 * }
 * ```
 */
export function useFileCompletion(
  options: UseFileCompletionOptions,
): UseFileCompletionResult {
  const { cwd, query, enabled, maxResults = 20 } = options;

  const [allFiles, setAllFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanTrigger, setScanTrigger] = useState(0);

  /**
   * Scan files when component mounts or when refresh is called
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const scanFiles = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const entries = await fileScanner.scan(cwd);
        if (!cancelled) {
          setAllFiles(entries);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to scan files");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    scanFiles();

    return () => {
      cancelled = true;
    };
  }, [cwd, enabled, scanTrigger]);

  /**
   * Perform fuzzy matching on the scanned files
   * Memoized to avoid re-calculating on every render
   *
   * For directories, adds trailing slash to path for clear folder indication
   */
  const suggestions = useMemo(() => {
    if (!enabled || allFiles.length === 0) {
      return [];
    }

    const matches = fuzzyMatch(query, allFiles);

    return matches.slice(0, maxResults);
  }, [enabled, allFiles, query, maxResults]);

  /**
   * Manual refresh function to re-scan files
   */
  const refresh = () => {
    setScanTrigger((prev) => prev + 1);
  };

  return {
    suggestions,
    isLoading,
    error,
    totalFiles: allFiles.length,
    refresh,
  };
}

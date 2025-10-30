/**
 * Fuzzy search matcher for file paths using fuzzysort library
 *
 * This module provides fuzzy matching for file paths to support autocomplete.
 * It limits results to 20 items for performance in large projects.
 */

import Fuzzysort from "fuzzysort";

import { FileEntry } from "./types";

/**
 * Maximum number of results to return for performance
 * In large projects with thousands of files, limiting results improves UX
 */
const MAX_RESULTS = 20;

/**
 * Minimum score threshold for fuzzy matching
 * Results with scores below this are filtered out
 * Lower scores = worse matches
 */
const MIN_SCORE = -10000;

/**
 * Perform fuzzy search on file entries
 *
 * @param query - The search query (e.g., "src/util" or "uti")
 * @param entries - Array of file entries to search through
 * @returns Array of matched results, sorted by relevance (best matches first)
 *
 * @example
 * ```ts
 * const entries = [
 *   { path: 'src/utils/helper.ts', type: 'file', size: 1024 },
 *   { path: 'src/components/Button.tsx', type: 'file', size: 2048 }
 * ];
 * const results = fuzzyMatch('util', entries);
 * // Returns: [{ entry: { path: 'src/utils/helper.ts', ... }, score: 100, highlight: '...' }]
 * ```
 */
export function fuzzyMatch(query: string, entries: FileEntry[]): FileEntry[] {
  if (!query || query.trim().length === 0) {
    // No query = return first N files as-is
    return entries.slice(0, MAX_RESULTS);
  }

  // Prepare targets for fuzzysort (need to extract path strings)
  const prepared = entries.map((entry) => ({
    entry,
    target: Fuzzysort.prepare(entry.path),
  }));

  // Perform fuzzy search
  const results = Fuzzysort.go(query, prepared, {
    key: "target",
    limit: MAX_RESULTS,
    threshold: MIN_SCORE,
  });

  // Transform fuzzysort results to our format
  return results.map((result) => {
    const entry = result.obj.entry;

    // Add trailing slash to directories for clear indication
    // This ensures directories always show with proper path format
    if (entry.type === "directory" && !entry.path.endsWith("/")) {
      return {
        ...entry,
        path: entry.path + "/",
      };
    }

    return entry;
  });
}

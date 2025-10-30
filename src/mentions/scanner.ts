import fs from "fs/promises";
import path from "path";

import { FileEntry } from "./types";
import { isTextFile } from "./utils";
import { debugLog } from "../logging";

/**
 * Directories to skip during scanning
 * These are typically large directories that don't contain user code
 */
const IGNORE_DIRS = new Set([
  "node_modules", // NPM dependencies
  ".git", // Git repository data
  ".next", // Next.js build output
  "dist", // Distribution/build output
  "build", // Build output
  ".turbo", // Turborepo cache
  "coverage", // Test coverage reports
]);

/**
 * File system scanner with caching
 *
 * Recursively scans directories to find all eligible files for @mention autocomplete.
 * Results are cached for 5 minutes to avoid repeated expensive file system operations.
 *
 * Filtering rules:
 * - Only text files (based on extension)
 * - Not in ignore list (node_modules, .git, etc.)
 * - Skip symbolic links
 * - Max recursion depth: 10 levels
 */
export class FileScanner {
  /**
   * Cache map: rootDir -> { entries, timestamp }
   * Stores scan results with timestamp for TTL validation
   */
  private cache: Map<string, { entries: FileEntry[]; timestamp: number }> =
    new Map();

  /**
   * Cache time-to-live: 5 minutes
   * After this period, cache is considered stale and rescan is triggered
   */
  private readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * Scan a directory and return all eligible files
   *
   * Uses cache if available and not expired (< 5 minutes old).
   * Otherwise performs full recursive scan and updates cache.
   *
   * @param rootDir - Absolute path to directory to scan
   * @returns Array of file entries (files and directories)
   */
  async scan(rootDir: string): Promise<FileEntry[]> {
    // Check cache first
    const cached = this.cache.get(rootDir);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.entries;
    }

    // Perform fresh scan
    const entries = await this.scanDirectory(rootDir, rootDir);

    // Update cache
    this.cache.set(rootDir, { entries, timestamp: Date.now() });

    return entries;
  }

  /**
   * Recursively scan a directory
   *
   * @param dir - Current directory being scanned (absolute path)
   * @param rootDir - Root directory for calculating relative paths
   * @param depth - Current recursion depth (0 = root level)
   * @returns Array of file entries found in this directory and subdirectories
   */
  private async scanDirectory(
    dir: string,
    rootDir: string,
    depth = 0,
  ): Promise<FileEntry[]> {
    // Limit recursion depth to prevent performance issues and stack overflow
    // 10 levels should be sufficient for most project structures
    if (depth > 10) return [];

    const entries: FileEntry[] = [];

    try {
      // Read directory contents with file type information (faster than stat)
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(rootDir, fullPath);

        // Skip symbolic links entirely (avoid infinite loops and confusion)
        if (item.isSymbolicLink()) {
          continue;
        }

        if (item.isDirectory()) {
          // Skip ignored directories (node_modules, .git, etc.)
          if (IGNORE_DIRS.has(item.name)) {
            continue;
          }

          // Add directory entry (for @folder mentions)
          entries.push({
            path: relativePath,
            type: "directory",
          });

          // Recursively scan subdirectory
          const subEntries = await this.scanDirectory(
            fullPath,
            rootDir,
            depth + 1,
          );
          entries.push(...subEntries);
        } else if (item.isFile()) {
          // Filter: only text files
          if (!isTextFile(fullPath)) {
            continue;
          }

          // Add file entry
          entries.push({
            path: relativePath,
            type: "file",
          });
        }
      }
    } catch (err) {
      // Gracefully handle permission errors or other file system issues
      // Log warning but continue scanning other directories
      debugLog(`Failed to scan ${dir}:`, { err });
    }

    return entries;
  }

  /**
   * Clear all cached scan results
   * Useful for testing or when file system changes need to be reflected immediately
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Singleton instance of FileScanner
 * Shared across the application to maintain a single cache
 */
export const fileScanner = new FileScanner();

import path from "path";

/**
 * Path Prefix Checker
 *
 * Responsible for verifying if file paths are within authorized prefixes.
 * This is a core security mechanism to prevent unauthorized file access.
 */

/**
 * Check if a target path is under an authorized prefix.
 *
 * Algorithm:
 * 1. Validate both filePath and prefix are absolute paths (required)
 * 2. Normalize both paths to absolute paths
 * 3. Use startsWith for prefix matching
 *
 * Security Notes:
 * - Both filePath and prefix MUST be absolute paths, relative paths are rejected
 * - Always resolves paths to absolute form to prevent directory traversal
 * - Case-sensitive matching (appropriate for Unix/Linux systems)
 *
 * @param filePath The target file path to check (MUST be absolute)
 * @param prefix The authorized prefix path (MUST be absolute)
 * @returns true if filePath is under prefix, false otherwise
 * @throws Error if either filePath or prefix is not an absolute path
 *
 * @example
 * ```typescript
 * isPathUnderPrefix('/home/user/project/src/main.ts', '/home/user/project')
 * // => true
 *
 * isPathUnderPrefix('/home/user-project/file.txt', '/home/user')
 * // => false (different path)
 *
 * isPathUnderPrefix('../../../etc/passwd', '/home/user/project')
 * // => Error: filePath must be absolute path
 * ```
 */
export function isPathUnderPrefix(filePath: string, prefix: string): boolean {
  // Validate inputs are absolute paths
  if (!path.isAbsolute(filePath)) {
    throw new Error(`filePath must be absolute path, got: ${filePath}`);
  }
  if (!path.isAbsolute(prefix)) {
    throw new Error(`prefix must be absolute path, got: ${prefix}`);
  }

  // Normalize to absolute paths
  const normalizedFile = path.resolve(filePath);
  const normalizedPrefix = path.resolve(prefix);

  return normalizedFile.startsWith(normalizedPrefix);
}

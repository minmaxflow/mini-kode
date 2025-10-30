import { isTextFile } from "../utils/file-type";

/**
 * Check if a file is a text file based on extension
 *
 * Uses a whitelist approach for security and simplicity.
 * Only files with known text extensions are considered text files.
 *
 * @param filePath - Path to file (can be relative or absolute)
 * @returns true if file extension is in whitelist, false otherwise
 *
 * @example
 * isTextFile('src/app.ts')      // => true
 * isTextFile('image.png')       // => false
 * isTextFile('README')          // => false (no extension)
 */
export { isTextFile };

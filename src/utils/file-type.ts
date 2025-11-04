import fs from "fs";
import path from "path";

/**
 * Text file extensions whitelist
 */
const TEXT_EXTENSIONS = new Set([
  // JavaScript/TypeScript
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",

  // Other programming languages
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".sh",
  ".bash",
  ".zsh",

  // Markup and data formats
  ".html",
  ".xml",
  ".svg",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".md",
  ".mdx",
  ".txt",
  ".csv",

  // Stylesheets
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",

  // Configuration files
  ".env",
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".eslintrc",
  ".prettierrc",
  ".babelrc",

  // Other
  ".sql",
  ".graphql",
  ".proto",
]);

/**
 * Check if buffer contains only text characters
 *
 * @param buffer - Buffer to check
 * @returns true if buffer contains only text characters
 */
export function isTextBuffer(buffer: Buffer): boolean {
  // Check if buffer contains only text characters
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // Text files should not contain null bytes or control characters
    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a file is a text file using content-based detection
 *
 * @param filePath - Path to file
 * @returns true if file content appears to be text
 */
export function isTextFileByContent(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);
    return isTextBuffer(buffer.subarray(0, bytesRead));
  } catch {
    return false;
  }
}

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
 * isTextFileByExtension('src/app.ts')      // => true
 * isTextFileByExtension('image.png')       // => false
 * isTextFileByExtension('README')          // => false (no extension)
 */
export function isTextFileByExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

/**
 * Check if a file is a text file
 *
 * Uses a combination of extension-based and content-based detection.
 *
 * @param filePath - Path to file (can be relative or absolute)
 * @returns true if file is a text file, false otherwise
 *
 * @example
 * isTextFile('src/app.ts')      // => true (known extension)
 * isTextFile('image.png')       // => false (binary extension)
 * isTextFile('unknown.xyz')     // => true/false (content detection)
 */
export function isTextFile(filePath: string): boolean {
  // First check by extension for performance
  if (isTextFileByExtension(filePath)) {
    return true;
  }

  // Fallback to content-based detection for unknown extensions
  return isTextFileByContent(filePath);
}

/**
 * MIME type detection for web content
 */

/**
 * Detected content type from MIME
 */
export interface DetectedContentType {
  mimeType: string;
  category:
    | "html"
    | "text"
    | "json"
    | "xml"
    | "css"
    | "javascript"
    | "unsupported";
}

/**
 * Parse Content-Type header and extract MIME type
 *
 * @param contentType - Content-Type header value
 * @returns MIME type without charset or other parameters
 */
export function parseContentType(contentType: string): string {
  if (!contentType) return "";

  // Extract MIME type before semicolon
  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  return mimeType;
}

/**
 * Detect content type from MIME type
 *
 * @param mimeType - MIME type string
 * @returns Detection result with categorization
 */
export function detectContentType(mimeType: string): DetectedContentType {
  const normalizedMime = parseContentType(mimeType);

  // Determine category
  let category: DetectedContentType["category"];

  if (normalizedMime === "text/html") {
    category = "html";
  } else if (
    normalizedMime === "text/plain" ||
    normalizedMime === "text/markdown"
  ) {
    category = "text";
  } else if (normalizedMime === "application/json") {
    category = "json";
  } else if (normalizedMime.includes("xml")) {
    category = "xml";
  } else if (normalizedMime === "text/css") {
    category = "css";
  } else if (normalizedMime.includes("javascript")) {
    category = "javascript";
  } else {
    category = "unsupported";
  }

  return {
    mimeType: normalizedMime,
    category,
  };
}

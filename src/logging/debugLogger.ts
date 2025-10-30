import fs from "fs";
import { getDebugLogPath } from "./paths";

/**
 * Internal debug logger for troubleshooting UI and input handling issues.
 * Writes directly to debug.log without pretty formatting for maximum detail.
 *
 * Usage:
 *   import { debugLog } from '@/logging/debugLogger';
 *   debugLog('useInput triggered', { key: 'return', input: '' });
 */

let debugStream: fs.WriteStream | null = null;

function ensureDebugStream(): fs.WriteStream {
  if (!debugStream) {
    // Clear the debug log file before creating the stream
    try {
      fs.writeFileSync(getDebugLogPath(), "", { flag: "w" });
    } catch (error) {
      // If the file doesn't exist, that's fine - it will be created
    }
    debugStream = fs.createWriteStream(getDebugLogPath(), { flags: "a" });
  }
  return debugStream;
}

export function debugLog(message: string, data?: Record<string, any>): void {
  const stream = ensureDebugStream();

  const logEntry = {
    message,
    ...(data || {}),
  };

  stream.write(JSON.stringify(logEntry) + "\n");
}
// Cleanup on exit
if (typeof process !== "undefined") {
  process.on("exit", () => {
    if (debugStream) {
      debugStream.end();
      debugStream = null;
    }
  });
}

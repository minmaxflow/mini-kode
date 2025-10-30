import fs from "fs";
import path from "path";
import os from "os";

import type { Session } from "./types";

/**
 * Get the path for session JSON file
 */
function getSessionJsonPath(sessionId: string): string {
  const configDir = path.join(os.homedir(), ".mini-kode");
  const sessionsDir = path.join(configDir, "sessions");

  // Ensure directories exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  return path.join(sessionsDir, `${sessionId}.json`);
}

/**
 * Save session to disk
 */
export async function saveSession(session: Session): Promise<void> {
  const file = getSessionJsonPath(session.sessionId);
  await fs.promises.writeFile(
    file,
    JSON.stringify(session, null, 2) + "\n",
    "utf8",
  );
}

/**
 * Load session from disk
 * Returns null if session not found
 */
export async function loadSession(sessionId: string): Promise<Session | null> {
  const file = getSessionJsonPath(sessionId);
  try {
    const content = await fs.promises.readFile(file, "utf8");
    return JSON.parse(content);
  } catch (error) {
    // If file doesn't exist or any other error occurs, return null
    return null;
  }
}

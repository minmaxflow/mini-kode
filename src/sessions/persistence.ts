import fs from "fs";

import { getSessionJsonPath } from "../logging/paths";
import type { Session } from "./types";

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

import fs from "fs";
import { ensureLogDirs, getSessionsDir } from "./paths";

function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

async function safeRemoveDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}

export async function startupCleanup(): Promise<void> {
  const shouldClear = parseBooleanEnv(
    process.env.MINIKODE_CLEAR_LOGS_ON_START,
    true,
  );
  if (!shouldClear) return;

  const sessionsDir = getSessionsDir();
  await safeRemoveDir(sessionsDir);

  ensureLogDirs();
}

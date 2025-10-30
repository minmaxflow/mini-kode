import fs from "fs";
import os from "os";
import path from "path";

const HOME_DIR = os.homedir();
const ROOT_DIR = path.join(HOME_DIR, ".mini-kode");
const LOGS_DIR = path.join(ROOT_DIR, "logs");
const SESSIONS_DIR = path.join(LOGS_DIR, "sessions");

export function getLogsRootDir(): string {
  return LOGS_DIR;
}

export function getSessionsDir(): string {
  return SESSIONS_DIR;
}

export function getTraceLogPath(): string {
  return path.join(LOGS_DIR, "trace.log");
}

export function getDebugLogPath(): string {
  return path.join(LOGS_DIR, "debug.log");
}

export function getSessionJsonPath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

export function ensureLogDirs(): void {
  for (const dir of [ROOT_DIR, LOGS_DIR, SESSIONS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  const traceLog = getTraceLogPath();
  if (!fs.existsSync(traceLog)) fs.writeFileSync(traceLog, "", "utf8");
  const debugLog = getDebugLogPath();
  if (!fs.existsSync(debugLog)) fs.writeFileSync(debugLog, "", "utf8");
}

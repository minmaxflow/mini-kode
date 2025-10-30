import pino from "pino";
import { getTraceLogPath } from "./paths";

const transport = pino.transport({
  targets: [
    {
      target: "pino-pretty",
      options: {
        destination: getTraceLogPath(),
        mkdir: true,
        // truncate the file on startup
        append: false,
        colorize: false,
        translateTime: false, // Hide timestamp
        ignore: "pid,hostname,level,time", // Hide level (DEBUG:), time, etc
        singleLine: false,
        messageFormat: "{msg}", // Only show message, data will be shown below
      },
      level: "debug",
    },
  ],
});

export const logger = pino(
  {
    level: process.env.MINIKODE_LOG_LEVEL || "debug",
    base: undefined,
  },
  transport,
);

export function logDebug(msg: string, obj?: unknown) {
  logger.debug(obj as any, msg);
}

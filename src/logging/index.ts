/**
 * Logging System
 *
 * Centralized exports for the logging system.
 * Provides a clean, minimal API for logging operations.
 */

export { debugLog } from "./debugLogger";

export {
  traceAgentStart,
  traceAgentEnd,
  traceLLMRequest,
  traceLLMResponse,
  traceToolStart,
  traceToolPermissionRequired,
  traceToolPermissionGranted,
  traceToolPermissionRejected,
  traceToolResult,
  traceUserApproval,
  traceUserRejection,
  traceUserAbort,
} from "./traceLogger";

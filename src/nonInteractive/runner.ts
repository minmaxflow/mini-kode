/**
 * Non-Interactive Mode Runner
 *
 * Executes tasks directly without UI, triggered when a prompt is provided via CLI.
 *
 * Features:
 * - No UI rendering (no Ink)
 * - Silent execution (no streaming output)
 * - Final response only output to stdout
 * - Errors output to stderr
 * - Uses pre-configured permissions (project policy + CLI/approval mode)
 * - Returns appropriate exit codes
 *
 * Exit Codes:
 * - 0: Success
 * - 1: Permission denied
 * - 2: LLM error
 * - 3: Tool execution error
 * - 4: Unknown error
 */

import { executeAgent } from "../agent/executor";
import type { ExecutionCallbacks, ExecutionContext } from "../agent/types";
import type { ApprovalMode } from "../config";
import { ConfigManager } from "../config";
import type { PermissionUiHint } from "../tools/types";
import { createSession } from "../sessions/types";
import { mcpService } from "../mcp";

/**
 * Format permission hint for error message.
 */
function formatPermissionHint(hint: PermissionUiHint): string {
  if (hint.kind === "fs") {
    return `File system write access to: ${hint.path}`;
  } else if (hint.kind === "bash") {
    return `Bash command: ${hint.command}`;
  }
  return "unknown permission";
}

/**
 * Run agent in non-interactive mode.
 *
 * This function:
 * 1. Executes the agent with the given prompt
 * 2. Uses silent callbacks (no UI, no streaming output)
 * 3. Outputs final response to stdout
 * 4. Outputs errors to stderr
 * 5. Returns appropriate exit code
 *
 * Permission Handling:
 * - Only uses pre-configured permissions (project policy + CLI/approval mode)
 * - If approval mode is not provided via CLI, uses project's configured mode
 * - Any permission request that is not pre-approved will fail immediately
 *
 * @param prompt User's prompt/instruction
 * @param cwd Current working directory
 * @param approvalMode Optional approval mode override ('default' | 'autoEdit' | 'yolo')
 * @returns Exit code (0 = success, 1-4 = various errors)
 *
 * @example
 * ```typescript
 * // Run with default permissions
 * const exitCode = await runNonInteractive('Fix auth.ts', '/project');
 * process.exit(exitCode);
 *
 * // Run with yolo mode (auto-approve everything)
 * const exitCode = await runNonInteractive('Refactor codebase', '/project', 'yolo');
 * process.exit(exitCode);
 * ```
 */
export async function runNonInteractive(
  prompt: string,
  cwd: string,
  approvalMode?: ApprovalMode,
): Promise<number> {
  // Initialize MCP service (wait for completion in non-interactive mode)
  await mcpService.initialize(cwd);

  // Load configuration (approvalMode is now handled separately)
  const config = ConfigManager.load();

  const context: ExecutionContext = {
    cwd,
    getApprovalMode: () => approvalMode || "default",
    session: createSession(),
  };

  const callbacks: ExecutionCallbacks = {
    // Silent mode - no LLM message updates
    onLLMMessageUpdate: undefined,

    // Silent mode - no tool progress
    onToolStart: undefined,
    onToolComplete: undefined,

    // Permission requests always fail in non-interactive mode
    onPermissionRequired: async (hint: PermissionUiHint) => {
      // Output error to stderr
      console.error(`\nPermission required: ${formatPermissionHint(hint)}`);
      console.error(
        "In non-interactive mode, all permissions must be pre-configured.",
      );
      console.error(
        "Use --approval-mode option or configure project permissions.",
      );

      // Return rejection
      return {
        approved: false,
        reason: "user_rejected",
      };
    },

    // Output final response to stdout
    onComplete: (response: string) => {
      if (response) {
        console.log(response);
      }
    },

    // Output errors to stderr
    onError: (error: Error) => {
      console.error(`\nError: ${error.message}`);
    },
  };

  // Execute agent
  const result = await executeAgent(prompt, context, callbacks);

  // Determine exit code based on result
  if (result.success) {
    return 0; // Success
  }

  // Error cases
  const errorType = result.error?.type;

  if (errorType === "permission_denied") {
    console.error("\nExecution failed due to permission denial.");
    console.error("To resolve:");
    console.error("  1. Use --approval-mode yolo (auto-approve everything)");
    console.error("  2. Use --approval-mode autoEdit (auto-approve edits)");
    console.error(
      "  3. Pre-configure project permissions in .mini-kode/config.json",
    );
    return 1;
  }

  if (errorType === "llm_error") {
    console.error(`\nLLM API call failed: ${result.error?.message}`);
    console.error("Check your API key and network connection.");
    return 2;
  }

  if (errorType === "aborted") {
    console.error(`\nExecution was aborted: ${result.error?.message}`);
    return 3;
  }

  // Unknown error
  console.error(
    `\nExecution failed with unknown error: ${result.error?.message}`,
  );
  return 4;
}

/**
 * Run agent in non-interactive mode with string output (for testing).
 *
 * This is a test-friendly version that captures stdout/stderr instead
 * of directly writing to console.
 *
 * @param prompt User's prompt
 * @param cwd Current working directory
 * @param approvalMode Optional approval mode
 * @returns Object with exitCode, stdout, and stderr
 */
export async function runNonInteractiveWithCapture(
  prompt: string,
  cwd: string,
  approvalMode?: ApprovalMode,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  // Monkey-patch console to capture output for testing
  // This allows tests to verify both exit code and actual console output
  // without writing to the real console during test execution
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };

  console.error = (...args: any[]) => {
    stderrLines.push(args.map(String).join(" "));
  };

  try {
    const exitCode = await runNonInteractive(prompt, cwd, approvalMode);

    return {
      exitCode,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    // Restore console
    console.log = originalLog;
    console.error = originalError;
  }
}

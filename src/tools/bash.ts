import { spawn } from "child_process";
import { z } from "zod";

import { Tool, BashResult } from "./types";
import { PermissionRequiredError } from "./types";
import { checkBashApproval, validateBashCommand } from "../permissions";

const maxCharacters = 30000;

const InputSchema = z.object({
  command: z
    .string()
    .describe(
      "The bash command to execute. Use absolute paths and avoid 'cd' as shell state is not maintained. For security reasons, some commands are limited or banned.",
    ),
  timeout: z
    .number()
    .int()
    .positive()
    .max(600000)
    .optional()
    .describe(
      "Optional timeout in milliseconds (max 600000ms / 10 minutes). If not specified, defaults to 180000ms (3 minutes).",
    ),
});

export type BashInput = z.infer<typeof InputSchema>;

export const BASH_TOOL_PROMPT: string = `
Executes a given bash command with optional timeout, ensuring proper handling and security measures.

IMPORTANT: Platform Compatibility
- Current platform information is available *<env>** tag
- macOS and Linux have different command syntaxes for some tools
- ALWAYS check the platform and use appropriate syntax for the current platform.

Before executing the command, please follow these steps:

1. Directory Verification:
   - If the command will create new directories or files, first use the LS tool to verify the parent directory exists and is the correct location
   - For example, before running "mkdir foo/bar", first use LS to check that "foo" exists and is the intended parent directory

2. Security Check:
   - For security and to limit the threat of a prompt injection attack, some commands are limited or banned. If you use a disallowed command, you will receive an error message explaining the restriction. Explain the error to the User.
   - Verify that the command is not one of the banned commands: alias, curl, curlie, wget, axel, aria2c, nc, telnet, lynx, w3m, links, httpie, xh, http-prompt, chrome, firefox, safari.

3. Command Execution:
   - After ensuring proper quoting, execute the command.
   - Capture the output of the command.

4. Output Processing:
   - If the output exceeds ${maxCharacters} characters, output will be truncated before being returned to you.
   - Prepare the output for display to the user.

5. Return Result:
   - Provide the processed output of the command.
   - If any errors occurred during execution, include those in the output.

Usage notes:
  - The command argument is required.
  - You can specify an optional timeout in milliseconds (up to 600000ms / 10 minutes). If not specified, commands will timeout after 3 minutes.
  - VERY IMPORTANT: You MUST avoid using search commands like \`find\` and \`grep\`. Instead use "grep", "glob" to search. You MUST avoid read tools like \`cat\`, \`head\`, \`tail\`, and \`ls\`, and use "fileRead" and "listFiles" to read files.
  - When issuing multiple commands, use the ';' or '&&' operator to separate them. DO NOT use newlines (newlines are ok in quoted strings).
  - You must use absolute paths and avoiding usage of \`cd\`, as we do not maintain shell state.
  <good-example>
  pytest /foo/bar/tests
  </good-example>
  <bad-example>
  cd /foo/bar && pytest tests
  </bad-example>

# Committing changes with git

When the user asks you to create a new git commit, follow these steps carefully:

1. Start with a single message that contains exactly three tool_use blocks that do the following (it is VERY IMPORTANT that you send these tool_use blocks in a single message, otherwise it will feel slow to the user!):
   - Run a git status command to see all untracked files.
   - Run a git diff command to see both staged and unstaged changes that will be committed.
   - Run a git log command to see recent commit messages, so that you can follow this repository's commit message style.

2. Use the git context at the start of this conversation to determine which files are relevant to your commit. Add relevant untracked files to the staging area. Do not commit files that were already modified at the start of this conversation, if they are not relevant to your commit.

3. Analyze all staged changes (both previously staged and newly added) and draft a commit message.

- List the files that have been changed or added
- Summarize the nature of the changes (eg. new feature, enhancement to an existing feature, bug fix, refactoring, test, docs, etc.)
- Brainstorm the purpose or motivation behind these changes
- Do not use tools to explore code, beyond what is available in the git context
- Assess the impact of these changes on the overall project
- Check for any sensitive information that shouldn't be committed
- Draft a concise (1-2 sentences) commit message that focuses on the "why" rather than the "what"
- Ensure your language is clear, concise, and to the point
- Ensure the message accurately reflects the changes and their purpose (i.e. "add" means a wholly new feature, "update" means an enhancement to an existing feature, "fix" means a bug fix, etc.)
- Ensure the message is not generic (avoid words like "Update" or "Fix" without context)
- Review the draft message to ensure it accurately reflects the changes and their purpose

5. If the commit fails due to pre-commit hook changes, retry the commit ONCE to include these automated changes. If it fails again, it usually means a pre-commit hook is preventing the commit. If the commit succeeds but you notice that files were modified by the pre-commit hook, you MUST amend your commit to include them.

6. Finally, run git status to make sure the commit succeeded.

Important notes:
- When possible, combine the "git add" and "git commit" commands into a single "git commit -am" command, to speed things up
- However, be careful not to stage files (e.g. with \`git add .\`) for commits that aren't part of the change, they may have untracked files they want to keep around, but not commit.
- NEVER update the git config
- DO NOT push to the remote repository
- IMPORTANT: Never use git commands with the -i flag (like git rebase -i or git add -i) since they require interactive input which is not supported.
- If there are no changes to commit (i.e., no untracked files and no modifications), do not create an empty commit
- Ensure your commit message is meaningful and concise. It should explain the purpose of the changes, not just describe them.
- Return an empty response - the user will see the git output directly
`.trim();

export const BashTool: Tool<BashInput, BashResult> = {
  name: "bash",
  description: BASH_TOOL_PROMPT,
  readonly: false,
  inputSchema: InputSchema,
  async execute(input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const { command } = input;

    const structural = validateBashCommand(command);
    if (!structural.allowed)
      return { isError: true, message: structural.reason };

    const approval = checkBashApproval(
      context.cwd,
      command,
      context.approvalMode,
    );
    if (!approval.ok) {
      throw new PermissionRequiredError({
        kind: "bash",
        command,
        message: approval.message,
      });
    }

    return await runCommand(command, input.timeout ?? 180000, context.signal);
  },
};

async function runCommand(
  command: string,
  timeout: number,
  signal?: AbortSignal,
): Promise<BashResult> {
  if (signal?.aborted)
    return { isError: true, isAborted: true, message: "Aborted" };
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const start = Date.now();
    let truncated = false;
    let resolved = false;

    // Helper to resolve only once
    const resolveOnce = (result: BashResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve(result);
    };

    // Abort handler - immediately resolve with abort message
    const onAbort = () => {
      try {
        child.kill("SIGKILL");
      } catch {}
      // Immediately resolve with abort result, don't wait for close
      resolveOnce({
        isError: true,
        isAborted: true,
        message: "Command was aborted",
      });
    };
    signal?.addEventListener("abort", onAbort);

    // Timeout handler - kill process but wait for close event
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
      // Don't resolve here - let close event handle it
    }, timeout);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length + chunk.length > maxCharacters) {
        const remaining = Math.max(0, maxCharacters - stdout.length);
        stdout += chunk.slice(0, remaining);
        truncated = true;
      } else {
        stdout += chunk;
      }
    });
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length + chunk.length > maxCharacters) {
        const remaining = Math.max(0, maxCharacters - stderr.length);
        stderr += chunk.slice(0, remaining);
        truncated = true;
      } else {
        stderr += chunk;
      }
    });
    child.on("close", (code) => {
      resolveOnce({
        type: "bash",
        command,
        stdout,
        stderr,
        exitCode: code ?? 0,
        truncated,
        durationMs: Date.now() - start,
      });
    });
    child.on("error", () => {
      resolveOnce({ isError: true, message: "Failed to start command" });
    });
  });
}

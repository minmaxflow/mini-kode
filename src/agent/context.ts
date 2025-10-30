import fs from "fs";
import path from "path";

import { buildSystemPrompt } from "./prompts";
import { createClient } from "../llm/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

interface EnvironmentInfo {
  cwd: string;
  isGitRepo: boolean;
  platform: string;
  date: string;
  model: string;
}

function buildEnvironmentDetails(info: EnvironmentInfo): string {
  return `Here is useful information about the environment you are running in:
<env>
Working directory: ${info.cwd}
Is directory a git repo: ${info.isGitRepo}
Computer Platform: ${info.platform}
Today's date: ${info.date}
Model: ${info.model}
</env>`;
}

export function isGitRepository(cwd: string): boolean {
  try {
    const gitPath = path.join(cwd, ".git");
    return fs.existsSync(gitPath);
  } catch {
    return false;
  }
}

export async function buildSystemMessage(
  effectiveCwd: string,
): Promise<ChatCompletionMessageParam> {
  // Build environment info
  const client = createClient();

  const envInfo: EnvironmentInfo = {
    cwd: effectiveCwd,
    isGitRepo: isGitRepository(effectiveCwd),
    platform: process.platform,
    date: new Date().toISOString().split("T")[0]!,
    model: client.model,
  };

  const envDetails = buildEnvironmentDetails(envInfo);

  // Add AGENTS.md content if it exists
  let projectContext = "";
  const agentsPath = path.join(envInfo.cwd, "AGENTS.md");
  if (fs.existsSync(agentsPath)) {
    try {
      projectContext = fs.readFileSync(agentsPath, "utf8");
    } catch (err) {
      // Ignore
    }
  }

  const systemPrompt = buildSystemPrompt(envDetails, projectContext);
  return { role: "system", content: systemPrompt };
}

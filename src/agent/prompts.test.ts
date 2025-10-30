import { describe, it, expect } from "vitest";

import { buildSystemPrompt } from "./prompts";

describe("prompts", () => {
  const env = `Here is useful information about the environment you are running in:\n<env>\nWorking directory: /tmp\nIs directory a git repo: true\nPlatform: darwin\nToday's date: 2025-09-29\nModel: gpt-5\n</env>`;

  it("buildSystemPrompt injects env details and contains key clauses", () => {
    const s = buildSystemPrompt(env);
    expect(s).toContain(env);
    expect(s).toContain("You MUST answer concisely");
    expect(s).toContain(
      "Keep your responses short, since they will be displayed on a command line interface. You MUST answer concisely with fewer than 4 lines",
    );
    expect(s).toContain("One word answers are best");
    expect(s).toContain(
      "If you intend to call multiple tools and there are no dependencies between the calls, make all of the independent calls in the same function_calls block",
    );
  });
});

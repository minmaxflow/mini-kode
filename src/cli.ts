#!/usr/bin/env -S node --no-warnings=ExperimentalWarning

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { App } from "./ui/App";
import { runNonInteractive } from "./nonInteractive/runner";
import { createConfigCommand } from "./cli/config";

type GlobalOptions = {
  approvalMode?: "autoEdit" | "yolo" | "default";
  workDir?: string;
};

function findPackageJsonPath(startDir: string): string | null {
  let current: string | null = startDir;
  while (current) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function readPackageVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = findPackageJsonPath(here);
    if (!pkgPath) return "0.0.0";
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    if (pkg && typeof pkg.version === "string") return pkg.version as string;
  } catch {}
  return "0.0.0";
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command();
  const version = readPackageVersion();

  program
    .name("mini-kode")
    .description("mini-kode CLI - A command-line coding agent")
    .version(version, "-V, --version", "output the version number")
    .helpOption("-h, --help", "display help for command")
    .option(
      "-a, --approval-mode <mode>",
      "approval mode: default, autoEdit (auto-approve edits), or yolo (auto-approve all)",
      (value: string) => {
        if (!["default", "autoEdit", "yolo"].includes(value)) {
          throw new Error(`Invalid approval mode: ${value}`);
        }
        return value as "default" | "autoEdit" | "yolo";
      },
    )
    .option("-w, --work-dir <path>", "working directory for the agent");

  // Add config subcommand
  program.addCommand(createConfigCommand());

  program
    .argument("[prompt]", "task prompt (triggers non-interactive mode)")
    .action(async (prompt: string | undefined) => {
      const opts = program.opts<GlobalOptions>();
      const approvalMode = opts.approvalMode;
      const workDir = opts.workDir || process.cwd();

      // Non-interactive mode: Execute task directly when prompt is provided
      if (prompt) {
        const exitCode = await runNonInteractive(prompt, workDir, approvalMode);
        process.exit(exitCode);
      }

      // Interactive mode: Launch UI when no prompt is provided
      const element = React.createElement(App, {
        cwd: workDir,
        approvalMode,
      });
      const instance = render(element, {
        exitOnCtrlC: false,
      });
      await instance.waitUntilExit();
    });

  program.showHelpAfterError("(add -h for help)");
  program.showSuggestionAfterError();

  try {
    await program.parseAsync(argv);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

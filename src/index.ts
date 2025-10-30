#!/usr/bin/env -S node --no-warnings=ExperimentalWarning

import { runCli } from "./cli";
import { startupCleanup } from "./logging/cleanup";

await startupCleanup();

void runCli();

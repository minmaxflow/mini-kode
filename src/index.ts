#!/usr/bin/env -S node --no-warnings=ExperimentalWarning

// Increase max event listeners to handle multiple AbortSignal listeners in LLM streaming
// Agent loops may make multiple LLM calls with the same AbortSignal, causing MaxListenersExceededWarning
// This is not a memory leak as OpenAI SDK properly cleans up listeners after each request
import { EventEmitter } from "events";
EventEmitter.defaultMaxListeners = 200;

import { runCli } from "./cli";

void runCli();

# Trace Logging System

## Overview

The trace logging system provides visibility into the agent execution flow, including LLM interactions, tool execution, and user decisions. All content is logged completely without truncation for thorough debugging.

## Log Location

```bash
~/.mini-kode/logs/trace.log
```

**Format**: NDJSON (Newline Delimited JSON)  
**Log Level**: `debug` (control with `MINIKODE_LOG_LEVEL` environment variable)

## Log Categories

### 1. Agent Lifecycle

- `[AGENT] Start` - Session initialization
- `[AGENT] End` - Session completion

### 2. LLM Interactions

- `[LLM] → Request:` - Full message array in OpenAI format
- `[LLM] ← Assistant Message:` - Complete response with content, tool_calls, and finish_reason

### 3. Tool Execution

- `[TOOL] ⚙ Start` - Tool execution begins
- `[TOOL] 🔒 Permission Required` - Permission checks during execution
- `[TOOL] ✓ Permission Granted` - User granted permission
- `[TOOL] ✗ Permission Rejected` - User denied permission
- `[TOOL] ✓ Success` - Tool completed successfully
- `[TOOL] ✗ Error` - Tool execution failed
- `[TOOL] ⊘ Aborted` - Tool was cancelled

### 4. User Interactions

- `[USER] ✓ Approved` - User granted permission
- `[USER] ✗ Rejected` - User denied permission
- `[USER] ⊗ Aborted` - User aborted session

### 5. Errors

- `[AGENT] Error` - Agent errors with error type and details

## Basic Usage

### View Logs

```bash
# Real-time monitoring
tail -f ~/.mini-kode/logs/trace.log
```

## Log Management

### Log Levels

```bash
# Show all logs (default)
export MINIKODE_LOG_LEVEL=debug

# Hide trace logs
export MINIKODE_LOG_LEVEL=warn
export MINIKODE_LOG_LEVEL=error
```

### Log Cleanup

- Logs are cleared on app startup
- Manual cleanup: `rm ~/.mini-kode/logs/trace.log`

## Related Documentation

- [Tool System](./tools.md) - Tool execution
- [Permission System](./permission.md) - Permission handling
- [User Interface](./ui.md) - User interactions

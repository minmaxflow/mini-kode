# Tool System

## Overview

The tool system is the action execution engine that allows the AI assistant to interact with your codebase. It provides a unified interface for operations like file reading, editing, searching, and command execution.

## Core Concepts

### What are Tools?

Tools are **extensible actions** that the AI can use to help you with coding tasks. Each tool follows the same interface pattern:

```typescript
interface Tool<Input, Output> {
  name: string; // Unique identifier
  description: string; // For LLM understanding
  readonly: boolean; // Controls execution strategy
  inputSchema: z.ZodType<Input>; // Runtime validation
  execute(input: Input, context: ToolExecutionContext): Promise<Output>;
}
```

### Execution Strategy

The `readonly` flag determines how tools are executed:

- **`readonly: true`** → Tools run **concurrently** (safe, no side effects)
- **`readonly: false`** → Tools run **sequentially** (may modify state)

This optimization allows read operations to happen in parallel while ensuring write operations happen in order.

## Available Tools

| Tool         | Type      | Purpose              | Permission Required |
| ------------ | --------- | -------------------- | ------------------- |
| `fileRead`   | Read-only | Read file contents   | No (within project) |
| `fileEdit`   | Writing   | Modify file          | Yes                 |
| `listFiles`  | Read-only | List directory       | No                  |
| `grep`       | Read-only | Search pattern       | No                  |
| `glob`       | Read-only | Find by filename     | No                  |
| `bash`       | Writing   | Execute command      | Yes                 |
| `architect`  | Read-only | Generate plans (LLM) | No                  |
| `todo_read`  | Read-only | Read tasks           | No                  |
| `todo_write` | Read-only | Update tasks         | No                  |
| `fetch`      | Read-only | Fetch web content    | Yes                 |
| `MCP Tools`  | Dynamic   | External MCP servers | Yes                 |

## How Tools Work

### 1. Tool Registration

All tools are registered in a central registry, making them available to the LLM:

```typescript
// All tools are registered here
export const ALL_TOOLS = [
  FileReadTool,
  FileEditTool,
  BashTool,
  // ...
];
```

### 2. Execution Strategy

**Concurrent Mode** (all read-only tools):

```
Tool A ━━━━━━━┓
Tool B ━━━━━┓ ┃
Tool C ━━━━┓ ┃ ┃
            ↓ ↓ ↓
       Execute in parallel
            ↓
     Results appear as ready
```

**Sequential Mode** (any writing tools):

```
Tool A ━━━━━→ Tool B ━━━━━→ Tool C
       ↓            ↓            ↓
    Execute     Execute     Execute
```

### 3. Permission Integration

Tools automatically integrate with the permission system:

- **Read-only tools** typically don't need permissions
- **Writing tools** check permissions before execution
- **Permission requests** pause execution until user approves

### 3. Abort Controller Support

All tools must support cancellation through the AbortController signal:

```typescript
// Required check points:
// 1. Entry point
// 2. Before expensive operations (file I/O, network requests)
// 3. Inside long-running loops
// 4. Before/after async operations

if (context.signal?.aborted) {
  return { isError: true, isAborted: true, message: "Aborted" };
}
```

### 4. ToolCall Runtime State

**ToolCall** represents the runtime execution state that UI components render:

```typescript
type ToolCall = {
  requestId: string; // Unique tracking ID
  toolName: string; // Tool being executed
  input: unknown; // Tool parameters
  status: ToolCallStatus; // Current state: pending|executing|permission_required|success|error|abort
  startedAt: string; // Start timestamp
  endedAt?: string; // End timestamp
  result?: any; // Success output
  error?: ToolError; // Error details
  uiHint?: PermissionUiHint; // Permission prompt details
};

## MCP Tool Integration

Mini-Kode supports **Model Context Protocol (MCP)** servers, allowing you to extend the tool system with external services:

### How MCP Tools Work

1. **Server Discovery**: Configure MCP servers in `.mini-kode/mcp.json`
2. **Auto-registration**: Tools from connected servers are automatically registered
3. **Execution Bridge**: MCP tools execute through the MCP client manager
```

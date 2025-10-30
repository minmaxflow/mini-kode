# LLM Tool Integration

## Overview

This document provides an overview of how the **LLM (Language Model) and Tool System work together** to create a functional AI coding assistant.

## Core Concept: Agent Coordination

The system uses an **agent coordination pattern** with three main components:

- **LLM acts as the brain** - decides what actions to take
- **Tools act as the hands** - execute the actual operations
- **Agent coordinates** - manages the conversation and execution loop

## High-Level Architecture

```
User Request
     ↓
┌─────────────────┐
│   Agent Layer   │ ← Coordinates LLM + tools
│  - Executor     │   Builds context
│  - Context      │   Manages loop
└─────────────────┘
     ↓
┌─────────────────┐
│   LLM Layer     │ ← Makes decisions
│  - Client       │   Returns tool calls
│  - Streaming    │   Processes results
└─────────────────┘
     ↓
┌─────────────────┐
│  Tool Layer     │ ← Executes actions
│  - Runner       │   Handles permissions
│  - Registry     │   Returns results
└─────────────────┘
     ↓
Back to LLM for synthesis
```

## Key Components

### Agent Executor (`src/agent/executor.ts`)

Core execution engine that:

- Manages the LLM + tool calling loop
- Handles both interactive and non-interactive modes
- Coordinates streaming responses and tool execution
- Manages conversation length through auto-compaction (see [User Interface](./ui.md) for details)

### Session Management (`src/sessions/`)

- **Types**: Defines message formats and OpenAI API compliance
- **Validation**: Ensures proper message ordering for tool calls

### Permission System (`src/permissions/`)

- Manages security controls for file system and bash operations
- For detailed permission models, approval modes, and configuration, see [Permission System](./permission.md)

### Tool Executor (`src/agent/toolExecutor.ts`)

- Handles tool execution with permission integration
- Manages async permission requests and retry logic
- For detailed permission workflow, see [Permission System](./permission.md)

## Execution Flow

1. **User Input** → Agent receives prompt
2. **Context Building** → System message + session history + project context → LLM
3. **LLM Response** → Streaming text OR tool calls
4. **Tool Execution** → Permission check → Execute → Return results
5. **Loop Continuation** → Results fed back to LLM → Final response

## Project Context Integration

The system automatically incorporates project-specific context through the `AGENTS.md` file:

- **Automatic Reading**: System reads `AGENTS.md` file from project root
- **Context Integration**: Project context is included in system prompts for LLM
- **Persistent Memory**: `AGENTS.md` provides long-term project memory across sessions
- **Customizable**: Users can update `AGENTS.md` to provide project-specific information

## Auto-Compaction

The system automatically manages conversation length when approaching token limits. For detailed information about auto-compaction triggers, manual commands, and usage, see [User Interface](./ui.md).

## Key Features

- **Streaming**: Real-time LLM responses and progressive tool results
- **Permission Integration**: Multi-layer security with async approval flow (see [Permission System](./permission.md))
- **Auto-Compaction**: Automatic token management for long conversations (see [User Interface](./ui.md))
- **Dual Mode**: Interactive UI and non-interactive CLI support

## Related Documentation

- [Tools](./tools.md) - Tool system design
- [Permission System](./permission.md) - Permission handling
- [User Interface](./ui.md) - UI components, state management, and user interactions
- [Trace Logging](./trace.md) - Debug with trace logs

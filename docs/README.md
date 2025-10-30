# Mini-Code Documentation

## What is Mini-Code?

Mini-Code is an **educational AI coding assistant** that demonstrates how modern AI assistants work. It's designed to help you understand the architecture and workflows behind AI-powered coding tools.

### Learning Objectives

- **Understand AI Assistant Architecture**: See how agents coordinate between LLMs and tools
- **Learn Permission Systems**: Explore multi-layer security models for AI tools
- **Master Tool Integration**: Understand how tools are executed with proper validation
- **Study Async Workflows**: See how permission requests and tool execution work together

## Quick Navigation

| Topic                                             | Description                                       | Learning Focus  |
| ------------------------------------------------- | ------------------------------------------------- | --------------- |
| [System Architecture](./architecture.md)          | High-level system design and workflow             | Architecture    |
| [Configuration](./config.md)                      | Settings and API management                       | Customization   |
| [Tools](./tools.md)                               | Tool system concepts and execution                | Extensibility   |
| [Permission](./permission.md)                     | Multi-layer permission system                     | Security        |
| [LLM Tool Integration](./llm-tool-integration.md) | Complete integration flow                         | Coordination    |
| [User Interface](./ui.md)                         | UI components, state management, and interactions | User Experience |

## Key Learning Concepts

Mini-Code demonstrates several important concepts for building AI assistants:

### 1. Agent Coordination Pattern

The **Agent Executor** coordinates between LLM decisions and tool execution, creating a loop that continues until the task is complete.

### 2. Tool System Design

All tools implement a unified `Tool<Input, Output>` interface with intelligent execution:

- **Read-only tools** execute concurrently for better performance
- **Writing tools** execute sequentially to maintain consistency
- **Permission integration** ensures security before execution

### 3. Multi-Layer Permission System

Three-layer security model balancing safety with convenience:

- **Approval Modes**: Configurable auto-approval levels
- **Project Policy**: Persistent permissions stored in config
- **Session Policy**: Temporary grants for current session

### 4. Streaming Architecture

- **Real-time responses**: Users see LLM responses as they're generated
- **Progressive tool rendering**: Tools show results as they complete
- **Async permission handling**: Permission requests don't block the UI

### 5. User Control Features

- **Slash Commands**: Direct commands for session management (`/clear`, `/compact`, `/init`)
- **Auto-compaction**: Automatic conversation compression when token limits approach
- **Project Memory**: Persistent project context via `AGENTS.md` file

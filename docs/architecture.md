# System Architecture

## Overview

Mini-Code demonstrates modern AI assistant architecture through a **layered design** where each component has clear responsibilities and communicates through well-defined interfaces.

## Core Architecture

### High-Level Data Flow

```
User Request
     ↓
┌─────────────────┐
│   UI Layer      │ ← Terminal interface with Ink
│  - Input        │   Shows streaming responses
│  - Streaming    │   Displays permission prompts
│  - Permission   │   Renders tool results
└─────────────────┘
     ↓
┌─────────────────┐
│  Agent Layer    │ ← Core coordination engine
│  - Executor     │   Manages LLM + tool loop
│  - Context      │   Builds system prompts
│  - Tool Calling │   Coordinates execution
└─────────────────┘
     ↓
┌─────────────────┐
│   LLM Layer     │ ← Language model integration
│  - Client       │   Streaming chat completion
│  - Tool Parsing │   Extracts tool calls
│  - Response     │   Formats for conversation
└─────────────────┘
     ↓
┌─────────────────┐
│  Tool Layer     │ ← Action execution system
│  - Registry     │   All available tools
│  - Runner       │   Batch execution
│  - Permission   │   Security checks
└─────────────────┘
     ↓
Tool Results
     ↓
┌─────────────────┐
│ Infrastructure  │ ← Supporting systems
│  - Config       │   Settings & approval modes
│  - Permissions  │   Security policies

└─────────────────┘
```

## Component Deep Dive

### 1. User Interface Layer

**Purpose**: Terminal-based interface that provides real-time feedback

**Key Components**:

- **App.tsx**: Main orchestrator that connects all layers
- **Message Feed**: Shows streaming LLM responses and tool results
- **Permission Prompts**: Interactive permission requests
- **Tool Views**: Specialized displays for different tool types

**Learning Focus**: Building responsive terminal interfaces that handle async operations and streaming data.

### 2. Agent Layer

**Purpose**: Core coordination engine that manages the LLM + tool execution loop

**Key Components**:

- **Executor**: Main loop that coordinates between LLM decisions and tool execution
- **Context Builder**: Creates system prompts with project context
- **Tool Call Handler**: Processes LLM tool calls and manages execution

**Workflow**:

1. Receive user request
2. Send to LLM with tool descriptions
3. Parse LLM response (text or tool calls)
4. If tool calls: Execute tools and add results to conversation
5. Repeat until LLM provides final response

**Learning Focus**: Agent coordination patterns, conversation management, and async workflow orchestration.

### 3. LLM Layer

**Purpose**: Interface with language models for reasoning and tool selection

**Key Components**:

- **Streaming Client**: Real-time chat completion with tool support
- **Tool Formatting**: Converts internal tools to OpenAI format
- **Response Parsing**: Extracts tool calls from LLM responses

**Learning Focus**: LLM integration patterns, streaming responses, and tool calling APIs.

### 4. Tool Layer

**Purpose**: Extensible system for executing actions with proper validation

**Key Components**:

- **Tool Interface**: `Tool<Input, Output>` that all tools implement
- **Tool Registry**: Central registry of available tools
- **Tool Runner**: Batch execution with concurrency control
- **Permission Integration**: Built-in security checks

**Tool Categories**:

- **Read-only Tools**: File reading, searching (execute concurrently)
- **Writing Tools**: File editing, commands (execute sequentially)

**Learning Focus**: Tool system design, permission integration, and validation patterns.

### 5. Infrastructure Layer

**Purpose**: Supporting systems for configuration, security, and observability

**Key Components**:

- **Configuration**: Project and global settings with approval modes (see [Configuration](./config.md))
- **Permission System**: Multi-layer security with project + session policies (see [Permission System](./permission.md))

## Key Architectural Patterns

### 1. Async Permission Flow

The system uses an **async permission model** where tool execution checks permissions and prompts users when needed:

```
Tool Execution → Permission Check → User Prompt → Grant → Retry
```

**Why this matters**: Shows how to build secure AI systems that respect user consent while maintaining good UX. For detailed implementation, see [Permission System](./permission.md).

### 2. Streaming Architecture

**Real-time responses** allow users to see the AI's thinking process:

- LLM responses stream progressively
- Tool results appear as they complete
- Permission prompts don't block the interface

**Learning Value**: Demonstrates how to build responsive interfaces for long-running AI operations.

### 3. Extensible Tool System

**Unified interface** makes it easy to add new capabilities:

- All tools implement the same `Tool<Input, Output>` interface
- Tools automatically integrate with permission system
- Tools work with both interactive and non-interactive modes

**Educational Value**: Shows how to design extensible systems that can grow with new capabilities.

## Workflow Examples

### Simple File Reading

```
User: "What's in src/index.ts?"
     ↓
1. Agent sends request to LLM with tool descriptions
2. LLM decides to call fileRead tool
3. Tool executes and reads the file (read-only tools bypass permission checks)
4. Results added to conversation
5. LLM analyzes results and responds to user
```

### Complex Multi-Tool Operation

```
User: "Update all TypeScript interfaces to include JSDoc comments"
     ↓
1. LLM calls glob tool to find *.ts files
2. LLM calls fileRead concurrently for all interface files
3. LLM analyzes interfaces and decides to add JSDoc comments
4. LLM calls fileEdit to update files (triggers permission checks)
5. Permission system validates permissions and requests approval if needed
6. User grants permissions (if required), tools execute edits
7. Results combined and LLM provides completion summary
```

## Design Principles

### 1. Educational Focus

- Clear separation of concerns
- Well-documented interfaces
- Minimal dependencies

### 2. Real-World Patterns

- Agent coordination
- Tool calling
- Permission systems
- Streaming responses
- Error handling

### 3. Extensibility

- Add new tools by implementing the Tool interface (see [Tools](./tools.md))
- Extend UI with new component views (see [User Interface](./ui.md))
- Customize permission policies (see [Permission System](./permission.md))
- Add new configuration options (see [Configuration](./config.md))

## Next Steps

- [Tools System](./tools.md) - Learn about the tool execution engine
- [LLM Tool Integration](./llm-tool-integration.md) - See how LLM and tools work together
- [Permission System](./permission.md) - Understand the security model
- [Configuration](./config.md) - Learn about settings and approval modes

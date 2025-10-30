# User Interface

## Overview

Mini-Code features a modern terminal-based interface built with Ink (React for CLI). The UI provides real-time interaction with the AI assistant through streaming responses, tool execution visualization, and intuitive controls for conversation management.

## Core Features

### Real-Time Communication

- **Streaming Responses**: See AI responses appear progressively as they're generated
- **Tool Visualization**: Watch tool calls execute with live status updates
- **Permission Prompts**: Interactive permission requests for sensitive operations
- **Message Feed**: Complete conversation history with formatting and syntax highlighting

### Interactive Controls

- **@ Mentions**: Type `@` to quickly select and reference files and folders in your project
- **Slash Commands**: Special commands starting with `/` for system control
- **Keyboard Shortcuts**: Efficient keyboard navigation and controls
- **Auto-compaction**: Automatic conversation management to prevent token limits

### Status & Monitoring

- **Token Usage**: Real-time display of conversation token consumption
- **Approval Modes**: Visual indicators for current permission settings
- **Help System**: Contextual help and keyboard shortcuts

## UI State Management

The interface maintains a structured state that tracks all conversation and system activity:

### Messages (`messages`)

The primary message store containing different message types:

**LLMMessage**: OpenAI API messages with status tracking

- Wrapper around OpenAI `ChatCompletionMessageParam`
- Tracks message status (streaming, complete, error)
- Includes system, user, assistant, and tool role messages
- Handles errors and streaming state for UI display

**CommandMessage**: Slash command executions

- Command calls (`/clear`, `/compact`, `/init`)
- Execution status (executing → success | error)
- Command results and error messages
- Auto-triggered commands (like auto-compaction)

### Tool Calls (`toolCalls`)

Detailed tracking of all tool executions:

- **Request ID**: Unique identifier for each tool call
- **Tool Name**: Which tool is being executed (fileRead, fileEdit, etc.)
- **Status**: Current execution state (pending, executing, completed, failed)
- **Input Parameters**: What arguments were passed to the tool
- **Results**: Tool output and metadata
- **Timing**: Start and end timestamps
- **Permission Info**: Whether approval was required/granted

## Interactive Features

### @ File Mentions

Type `@` in the input to:

- Search and select files from your project
- Search and select folders from your project
- Quickly reference file and folder paths in conversation
- Filter by file extensions with `@.ts` or `@.json`

### Slash Commands

Special commands for system control:

#### `/clear` - Clear Conversation History

Clears all messages from the current session and starts fresh.

#### `/compact` - Manual Conversation Compaction

Reduces conversation history by creating a summary and keeping only essential context.

#### `/init` - Initialize Project Memory

Creates or updates `AGENTS.md` file to establish long-term project memory.

## Auto-Compaction

The system automatically manages long conversations to prevent token limit issues:

**Trigger**: When conversation token usage exceeds 115,000 tokens (90% of 128K limit)

**Process**:

1. System automatically detects high token usage after LLM responses
2. Creates a `/compact_auto_*` command call (marked as auto-triggered)
3. Generates comprehensive summary using the same process as `/compact`
4. Replaces conversation history with system message + summary
5. Continues the conversation seamlessly

## Visual Elements

### Help Bar

The bottom status bar shows:

- **Approval Mode Status**: Current permission setting with color coding
- **Token Usage**: Real-time token consumption with color warnings
- **Contextual Help**: Keyboard shortcuts and usage tips
- **Detailed Help**: Expandable help section with all shortcuts

### Message Types

- **User Messages**: Plain text with full formatting
- **AI Responses**: Streaming text with markdown support
- **Tool Calls**: Structured display with status indicators
- **Command Results**: Formatted output with success/error states
- **Permission Prompts**: Interactive approval requests

## Keyboard Shortcuts

| Shortcut         | Function             |
| ---------------- | -------------------- |
| `Ctrl+A`         | Toggle help panel    |
| `Shift+Tab`      | Cycle approval modes |
| `Ctrl+C` (twice) | Exit application     |
| `Option+Enter`   | Insert line break    |
| `Double Esc`     | Clear input          |
| `Ctrl+E`         | Open external editor |

## Component Architecture

The UI is built with React components using Ink:

- **App**: Main orchestrator connecting all layers
- **MessageFeed**: Displays conversation history with streaming
- **InputBar**: Handles user input with @ mentions and slash commands
- **HelpBar**: Status bar with help and monitoring
- **ToolViews**: Specialized displays for different tool types
- **PermissionPrompts**: Interactive permission requests

## Related Documentation

- [System Architecture](./architecture.md) - How UI integrates with the agent layer
- [LLM Tool Integration](./llm-tool-integration.md) - Message processing in the agent loop
- [Permission System](./permission.md) - Security model and approval modes

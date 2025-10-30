# Mini-Kode - Development Guide

## Technology Stack

- **TypeScript** - Static typing
- **pnpm** - Package management
- **Bun** - Runtime and build tool
- **Ink** - CLI UI with React
- **OpenAI SDK** - LLM integration
- **Vitest** - Testing framework
- **Zod** - Runtime type validation
- **Commander** - CLI framework

## Architecture

### Core Design
- **Tool Pattern**: All tools implement `Tool<Input, Output>` interface
- **Concurrency**: Readonly tools execute concurrently, writing tools sequentially
- **Streaming**: LLM responses stream progressively
- **Permissions**: Project-level + Session-level control
- **Dual Mode**: Interactive UI and non-interactive execution

### Key Modules
- **Tools** (`src/tools/`): Tool system with concurrency control
- **Permissions** (`src/permissions/`): Two-layer permission system
- **LLM** (`src/llm/`): Streaming client and tool integration
- **UI** (`src/ui/`): Ink-based CLI interface
- **Config** (`src/config/`): Multi-layer configuration system
- **Agent** (`src/agent/`): Core agent logic and session management

## Development Commands

```bash
pnpm run dev      # Development mode with file watching
pnpm run build    # Build with Bun (output to dist/index.mjs)
pnpm run test     # Run tests with Vitest
pnpm run lint     # Type check with TypeScript
pnpm run format   # Format code with Prettier
```

## Code Style Guidelines

### Import Organization
1. Node.js built-in libraries (`fs`, `path`, `os`, `crypto`)
2. Third-party libraries (`react`, `ink`, `chalk`, `zod`, `openai`)
3. Relative file imports (`./types`, `../utils`)

Each section separated by a blank line, alphabetically sorted within sections.

### Code Formatting
- Use `pnpm run format` to format all TypeScript/TSX and Markdown files
- Ensure all generated code follows import organization rules
- Run format command before committing changes

### Comment Language
All comments must be in English for consistency.

## Key Features

- **Dual Mode Support**: Interactive UI and non-interactive execution
- **Flexible LLM Support**: DeepSeek, OpenAI, and custom API providers
- **Fine-grained Permissions**: Project-level and session-level control
- **Streaming Responses**: Real-time output during execution
- **Configuration Management**: Multi-layer config with CLI commands
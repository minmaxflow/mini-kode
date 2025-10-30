# Permission System

## Overview

The permission system provides security controls using a **multi-layer approval model** that balances safety with convenience for AI assistant operations.

## Security Model

### Three-Layer Protection

1. **Approval Mode** (Config) - Global auto-approval settings
2. **Session Policy** (In-memory) - Temporary runtime permissions
3. **Project Policy** (Persistent) - Stored permissions in `.mini-kode/config.json`

**Resolution Logic**: Check layers in order, **first "yes" wins**.

### Approval Modes

| Mode       | Behavior                                  |
| ---------- | ----------------------------------------- |
| `default`  | Require user approval for all operations  |
| `autoEdit` | Auto-approve file system write operations |
| `yolo`     | Auto-approve everything (FS + bash)       |

## Permission Types and Grant Storage

### File System Permissions

**Operations**:

- **Read operations**: Auto-allowed
- **Write operations**: Require approval unless in autoEdit/yolo mode or previously granted
- **Internal config**: Auto-allowed for `.mini-kode/` directory operations

**Grant Patterns**:

- **Global grant**: `"*"` - Access to all files
- **Directory prefix**: `"/project/src"` - Access to directory and subdirectories
- **Specific file**: `"/project/src/main.ts"` - Access to specific file

**Storage**:

- **Session grants**: In-memory array, lost on restart, used for "Yes (only this time)" approvals
- **Project grants**: `.mini-kode/config.json`, persists across sessions, used for "Don't ask again" approvals

### Bash Command Permissions

**Operations**:

- **Banned commands**: Always rejected (curl, wget, nc, telnet, alias, etc.)
- **Valid commands**: Require approval unless in yolo mode or previously granted

**Grant Patterns**:

- **Global grant**: `"*"` - Access to all bash commands
- **Prefix pattern**: `"npm:*"` - Access to npm and all npm subcommands
- **Exact match**: `"git status"` - Access to specific command only

**Storage**:

- **Session grants**: In-memory array, lost on restart, used for "Yes (only this time)" approvals
- **Project grants**: `.mini-kode/config.json`, persists across sessions, used for "Don't ask again" approvals

## Permission Resolution

### File System Permission Flow

```
Write Operation Request
     ↓
Check Approval Mode (autoEdit/yolo = auto-approve)
     ↓
Check .mini-kode/ directory access (auto-allowed)
     ↓
Check Session Grants (in-memory, fast)
     ↓
Check Project Policy (persistent storage)
     ↓
If no grant found → Request user approval
```

### Bash Command Permission Flow

```
Bash Command Request
     ↓
Validate Command (check against blacklist)
     ↓
Check Approval Mode (yolo = auto-approve)
     ↓
Check Session Grants (in-memory, fast)
     ↓
Check Project Policy (persistent storage)
     ↓
If no grant found → Request user approval
```

## Security Features

### Path Validation

- **Absolute path requirement**: All paths must be absolute for security
- **Path normalization**: Uses `path.resolve()` to prevent traversal attacks
- **Prefix matching**: Verifies target paths are under authorized prefixes

### Command Validation

- **Blacklist approach**: Blocks dangerous commands rather than whitelisting safe ones
- **Pattern validation**: Forbids backticks (requires `$(...)` instead)
- **First-token checking**: Validates only the command portion (not arguments)
- **Clear error messages**: Provides rationale for blocked commands

## Configuration

### Setting Approval Mode

```bash
# Interactive approval (default)
mini-kode config set approvalMode default

# Auto-approve file write operations
mini-kode config set approvalMode autoEdit

# Auto-approve all operations (FS + bash)
mini-kode config set approvalMode yolo
```

### Project Policy Structure

```json
{
  "grants": [
    {
      "type": "fs",
      "pattern": "/project/src",
      "grantedAt": "2025-10-02T10:30:00.000Z"
    },
    {
      "type": "bash",
      "pattern": "npm:*",
      "grantedAt": "2025-10-02T10:31:00.000Z"
    }
  ]
}
```

## Related Documentation

- [Configuration](./config.md) - Approval mode settings
- [Tools](./tools.md) - Tool-permission integration
- [User Interface](./ui.md) - Permission prompts and approval workflow

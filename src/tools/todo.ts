import fs from "fs";
import path from "path";
import { z } from "zod";
import { Tool, TodoItem, TodoResult } from "./types";

function todosPath(cwd: string, sessionId: string): string {
  return path.join(cwd, ".mini-kode", "sessions", sessionId, "todos.json");
}

const TodoReadInput = z.object({});
const TodoWriteInput = z.object({
  todos: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
      priority: z.enum(["low", "medium", "high"]).optional(),
      description: z.string().optional(),
    }),
  ),
});

export const TODO_READ_TOOL_PROMPT: string = `Use this tool to read your todo list. Returns an array of todos. Keep outputs concise for CLI display; the UI can expand details.`;

export const TODO_WRITE_TOOL_PROMPT: string = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`;

export const TodoReadTool: Tool<z.infer<typeof TodoReadInput>, TodoResult> = {
  name: "todo_read",
  description: TODO_READ_TOOL_PROMPT,
  readonly: true,
  inputSchema: TodoReadInput,
  async execute(_input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const file = todosPath(context.cwd, context.sessionId);
    try {
      if (!fs.existsSync(file)) return { type: "todo_read", todos: [] };
      if (context.signal?.aborted)
        return { isError: true, isAborted: true, message: "Aborted" };
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      const todos = Array.isArray(parsed) ? (parsed as TodoItem[]) : [];
      return { type: "todo_read", todos };
    } catch {
      return { isError: true, message: "Failed to read todos" };
    }
  },
};

export const TodoWriteTool: Tool<z.infer<typeof TodoWriteInput>, TodoResult> = {
  name: "todo_write",
  description: TODO_WRITE_TOOL_PROMPT,
  // Note: readonly=true means it doesn't modify user files directly. It only writes to .mini-kode/sessions/ which are internal session files, not user project files.
  readonly: true,
  inputSchema: TodoWriteInput,
  async execute(input, context) {
    if (context.signal?.aborted)
      return { isError: true, isAborted: true, message: "Aborted" };
    const file = todosPath(context.cwd, context.sessionId);
    const dir = path.dirname(file);
    // TodoWriteTool operates on .mini-kode directory which is auto-allowed
    // for better UX (no permission prompts for internal tool operations)
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (context.signal?.aborted)
        return { isError: true, isAborted: true, message: "Aborted" };
      const tmp = file + ".tmp";
      fs.writeFileSync(
        tmp,
        JSON.stringify(input.todos, null, 2) + "\n",
        "utf8",
      );
      if (context.signal?.aborted)
        return { isError: true, isAborted: true, message: "Aborted" };
      fs.renameSync(tmp, file);
      return {
        type: "todo_write",
        todos: input.todos,
      };
    } catch {
      return { isError: true, message: "Failed to write todos" };
    }
  },
};

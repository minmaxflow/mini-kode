import { Box, Text } from "ink";

import type { TodoItem, TodoSuccess } from "../../../tools/types";
import { getCurrentTheme } from "../../theme";

export interface TodoResultViewProps {
  result: TodoSuccess;
}

function getStatusIcon(status: TodoItem["status"]): string {
  switch (status) {
    case "completed":
      return "✓";
    case "in_progress":
      return "▶";
    case "pending":
      return "○";
    case "cancelled":
      return "✗";
    default:
      return "?";
  }
}

function getStatusColor(status: TodoItem["status"]): string {
  switch (status) {
    case "completed":
      return getCurrentTheme().success;
    case "in_progress":
      return getCurrentTheme().warning;
    case "pending":
      return getCurrentTheme().secondary;
    case "cancelled":
      return getCurrentTheme().error;
  }
}

function TodoItemView({ item }: { item: TodoItem }) {
  const icon = getStatusIcon(item.status);
  const color = getStatusColor(item.status);
  const isStrikethrough =
    item.status === "completed" || item.status === "cancelled";

  return (
    <Box>
      <Text color={color} bold>
        {icon}
      </Text>
      <Text> </Text>
      <Text color={color} strikethrough={isStrikethrough}>
        {item.content}
      </Text>
    </Box>
  );
}

function TodoListView({ todos }: { todos: TodoItem[] }) {
  if (todos.length === 0) {
    return <Text dimColor>No todos</Text>;
  }

  return (
    <Box flexDirection="column">
      {todos.map((t) => (
        <TodoItemView key={t.id} item={t} />
      ))}
    </Box>
  );
}

export function TodoResultView({ result }: TodoResultViewProps) {
  return (
    <Box flexDirection="column">
      <TodoListView todos={result.todos} />
    </Box>
  );
}

export default TodoResultView;

import { Box, Text } from "ink";

import type { ToolCall } from "../../../tools/runner.types";
import { InkMarkdown } from "../../components/InkMarkdown";

export interface MCPResultViewProps {
  toolCall: ToolCall;
}

export function MCPResultView({ toolCall }: MCPResultViewProps) {
  const result = toolCall.result as Record<string, unknown>;

  // Check if we have textContent (preferred for display)
  if (typeof result.textContent === "string" && result.textContent.trim()) {
    return renderTextContent(result.textContent);
  }

  // Fallback to JSON display of structured content
  const jsonString = JSON.stringify(result, null, 2);
  return renderJSONContent(jsonString);
}

function renderTextContent(content: string) {
  const lines = content.trim().split("\n");
  const isTruncated = lines.length > 6;

  if (isTruncated) {
    const truncatedContent = lines.slice(0, 5).join("\n");
    return (
      <Box flexDirection="column">
        <InkMarkdown>{truncatedContent}</InkMarkdown>
        <Text dimColor>… +{lines.length - 5} lines</Text>
      </Box>
    );
  }

  return <InkMarkdown>{content}</InkMarkdown>;
}

function renderJSONContent(jsonString: string) {
  const lines = jsonString.split("\n");
  const isTruncated = lines.length > 6;
  const displayLines = isTruncated ? lines.slice(0, 5) : lines.slice(0, 6);

  return (
    <Box flexDirection="column">
      {displayLines.map((line, idx) => (
        <Text key={idx}>{line}</Text>
      ))}
      {isTruncated && <Text dimColor>… +{lines.length - 5} lines</Text>}
    </Box>
  );
}

export default MCPResultView;

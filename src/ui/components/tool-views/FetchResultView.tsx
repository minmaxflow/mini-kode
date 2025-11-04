import { Box, Text } from "ink";

import type { FetchSuccess } from "../../../tools/types";

export interface FetchResultViewProps {
  result: FetchSuccess;
}

export function FetchResultView({ result }: FetchResultViewProps) {
  const { url, content } = result;

  if (content.trim()) {
    const lines = content.trim().split("\n");
    const isTruncated = lines.length > 6;
    const displayLines = isTruncated ? lines.slice(0, 5) : lines.slice(0, 6);

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="blue">
            {url}
          </Text>
        </Box>
        <Box flexDirection="column">
          {displayLines.map((line, idx) => (
            <Text key={idx}>{line}</Text>
          ))}
          {isTruncated && <Text dimColor>… +{lines.length - 5} lines</Text>}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="blue">
          {url}
        </Text>
      </Box>
      <Box flexDirection="column">
        <Text dimColor>(No content)</Text>
      </Box>
    </Box>
  );
}

export default FetchResultView;
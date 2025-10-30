import { Box, Text } from "ink";

import type { BashSuccess } from "../../../tools/types";

export interface BashResultViewProps {
  result: BashSuccess;
}

export function BashResultView({ result }: BashResultViewProps) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (output) {
    const lines = output.trim().split("\n");
    const isTruncated = lines.length > 3;
    const displayLines = isTruncated ? lines.slice(0, 2) : lines.slice(0, 3);

    return (
      <Box flexDirection="column">
        {displayLines.map((line, idx) => (
          <Text key={idx}>{line}</Text>
        ))}
        {isTruncated && <Text dimColor>… +{lines.length - 2} lines</Text>}
      </Box>
    );
  }
  return <Text dimColor>(No content)</Text>;
}

export default BashResultView;

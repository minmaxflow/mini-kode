import { Box, Text } from "ink";

import type { FileReadSuccess } from "../../../tools/types";

export interface FileReadResultViewProps {
  result: FileReadSuccess;
}

export function FileReadResultView({ result }: FileReadResultViewProps) {
  const { offset, limit, totalLines } = result;
  const actualLines = Math.min(totalLines - offset, limit);
  const endLine = offset + actualLines;
  return (
    <Box flexDirection="column">
      <Text dimColor>
        {`Read ${actualLines} lines (${offset + 1}–${endLine} of ${totalLines})`}
      </Text>
    </Box>
  );
}

export default FileReadResultView;

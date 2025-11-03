import { Box, Text } from "ink";

import type { FileReadSuccess } from "../../../tools/types";

export interface FileReadResultViewProps {
  result: FileReadSuccess;
}

export function FileReadResultView({ result }: FileReadResultViewProps) {
  const { offset, limit, fileTotalLines } = result;
  // offset and limit are actual values returned by limitUtils (actualOffset, actualLimit)
  // limit represents the actual number of lines returned, not the requested limit
  const endLine = offset + limit;
  return (
    <Box flexDirection="column">
      <Text dimColor>
        {`Read ${limit} lines (${offset + 1}–${endLine} of ${fileTotalLines})`}
      </Text>
    </Box>
  );
}

export default FileReadResultView;

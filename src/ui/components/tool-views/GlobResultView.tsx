import { Text } from "ink";

import type { GlobSuccess } from "../../../tools/types";

export interface GlobResultViewProps {
  result: GlobSuccess;
}

export function GlobResultView({ result }: GlobResultViewProps) {
  const filesCount = result.files.length;

  if (filesCount === 0) {
    return <Text dimColor>No files found</Text>;
  }

  return (
    <Text dimColor>
      {filesCount} file{filesCount === 1 ? "" : "s"} found
    </Text>
  );
}

export default GlobResultView;

import { Box, Text } from "ink";

import type { ArchitectSuccess } from "../../../tools/types";
import LLMMessage from "../LLMMessage";

export interface ArchitectResultViewProps {
  result: ArchitectSuccess;
}

export function ArchitectResultView({ result }: ArchitectResultViewProps) {
  return (
    <Box flexDirection="column">
      <LLMMessage markdown={result.plan} />
    </Box>
  );
}

export default ArchitectResultView;

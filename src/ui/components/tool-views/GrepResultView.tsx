import { useMemo } from "react";
import { Box, Text } from "ink";

import type { GrepSuccess } from "../../../tools/types";

export interface GrepResultViewProps {
  result: GrepSuccess;
}

type Group = {
  filePath: string;
  matches: { lineNumber: number; line: string }[];
};

export function GrepResultView({ result }: GrepResultViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const m of result.matches) {
      const g = map.get(m.filePath) ?? { filePath: m.filePath, matches: [] };
      g.matches.push({ lineNumber: m.lineNumber, line: m.line });
      map.set(m.filePath, g);
    }
    return [...map.values()];
  }, [result.matches]);

  const matchesCount = result.matches.length;
  const filesCount = groups.length;

  if (matchesCount === 0) {
    return <Text dimColor>No matches found</Text>;
  }

  const matchesText = `${matchesCount} match${matchesCount === 1 ? "" : "es"}`;
  const filesText = `${filesCount} file${filesCount === 1 ? "" : "s"}`;

  return (
    <Text dimColor>
      {matchesText} in {filesText}
    </Text>
  );
}

export default GrepResultView;

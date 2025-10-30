import { Box, Text } from "ink";

import type { ListFilesSuccess } from "../../../tools/types";

export interface ListFilesResultViewProps {
  result: ListFilesSuccess;
}

export function ListFilesResultView({ result }: ListFilesResultViewProps) {
  // Show only count, no file list
  const dirs = result.entries.filter((e) => e.kind === "dir").length;
  const files = result.entries.filter((e) => e.kind === "file").length;

  const parts: string[] = [];

  if (dirs > 0) {
    parts.push(`${dirs} director${dirs === 1 ? "y" : "ies"}`);
  }

  if (files > 0) {
    parts.push(`${files} file${files === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return <Text dimColor>Empty directory</Text>;
  }

  return <Text dimColor>{parts.join(", ")}</Text>;
}

export default ListFilesResultView;

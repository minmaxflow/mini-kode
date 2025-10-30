import { Box, Text } from "ink";
import { getCurrentTheme } from "../theme";

export interface ErrorViewProps {
  message: string;
}

export function ErrorView({ message }: ErrorViewProps) {
  return (
    <Box>
      <Text color={getCurrentTheme().error}>
        ⎿{"  "}
        {message}
      </Text>
    </Box>
  );
}

export default ErrorView;

import { Box, Text } from "ink";

import { getCurrentTheme } from "../theme";

export function Logo() {
  return (
    <Box flexDirection="column">
      <Text color={getCurrentTheme().brand} bold>
        {"  __  __   ___   _   _   ___            ____    ___    ____    _____"}
      </Text>
      <Text color={getCurrentTheme().brand} bold>
        {
          " |  \\/  | |_ _| | \\ | | |_ _|          / ___|  / _ \\  |  _ \\  | ____|"
        }
      </Text>
      <Text color={getCurrentTheme().brand} bold>
        {
          " | |\\/| |  | |  |  \\| |  | |   _____  | |     | | | | | | | | |  _|  "
        }
      </Text>
      <Text color={getCurrentTheme().brand} bold>
        {
          " | |  | |  | |  | |\\  |  | |  |_____| | |___  | |_| | | |_| | | |___ "
        }
      </Text>
      <Text color={getCurrentTheme().brand} bold>
        {
          " |_|  |_| |___| |_| \\_| |___|          \\____|  \\___/  |____/  |_____|"
        }
      </Text>
    </Box>
  );
}

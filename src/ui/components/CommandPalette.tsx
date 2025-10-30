import { Box, Text } from "ink";
import { getCurrentTheme } from "../theme";
import { type CommandHandler } from "../commands";

export interface CommandPaletteProps {
  selectedIndex: number;
  commands: CommandHandler<any>[];
}

export function CommandPalette({
  selectedIndex,
  commands,
}: CommandPaletteProps) {
  return (
    <Box
      flexDirection="column"
      borderColor={getCurrentTheme().secondary}
      paddingX={1}
    >
      <Box flexDirection="column">
        {commands.map((command, index) => {
          const isSelected = index === selectedIndex;
          const color = isSelected ? getCurrentTheme().accent : undefined;

          return (
            <Box key={command.name} flexDirection="row">
              <Box width={10} marginRight={2}>
                <Text color={color}>{command.name}</Text>
              </Box>
              <Box flexGrow={1}>
                <Text color={getCurrentTheme().secondary}>
                  {command.description}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

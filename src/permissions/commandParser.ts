/**
 * Command Parser
 * 
 * Responsible for parsing and analyzing bash commands to extract meaningful
 * information for permission checking and validation.
 * 
 * Features:
 * - Extract main executable from compound commands
 * - Identify setup vs. execution commands
 * - Parse command structure for permission matching
 */

/**
 * Extract the main executable command from a compound bash command.
 * 
 * For compound commands like "cd /path && npm run test", this extracts "npm run test"
 * For simple commands like "ls -la", this returns the original command
 * 
 * @param command The bash command string
 * @returns The main executable command
 */
export function extractMainCommand(command: string): string {
  // Handle compound commands with &&, ||, ;
  const compoundSeparators = /\s*&&\s*|\s*\|\|\s*|\s*;\s*/;
  const parts = command.split(compoundSeparators);
  
  // Find the last non-empty part that contains an actual executable
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    if (part && !isSetupCommand(part)) {
      return part;
    }
  }
  
  // If no main command found, return the last part (for setup-only commands)
  const lastPart = parts[parts.length - 1]?.trim();
  return lastPart || command.trim();
}

/**
 * Check if a command is a setup command (cd, export, etc.)
 */
function isSetupCommand(command: string): boolean {
  const setupCommands = [
    'cd', 'export', 'source', '.', 'unset', 'alias', 'unalias',
    'set', 'env', 'pushd', 'popd', 'dirs'
  ];
  
  const firstWord = command.split(' ')[0];
  return setupCommands.includes(firstWord);
}

/**
 * Extract the command prefix (first word) from a command.
 * 
 * @param command The bash command string
 * @returns The command prefix (e.g., "npm" from "npm run test")
 */
export function extractCommandPrefix(command: string): string {
  const mainCommand = extractMainCommand(command);
  return mainCommand.split(' ')[0];
}
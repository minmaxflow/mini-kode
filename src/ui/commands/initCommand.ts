import { CommandHandler, InitResult } from "./command.types";

export const initCommand: CommandHandler<InitResult> = {
  name: "/init",
  description:
    "Initialize or update project memory by generating/updating AGENTS.md",
  execute: async (messages, llmClient, actions, onExecutePrompt) => {
    // Construct a prompt that will be submitted through the normal agent loop
    const initPrompt = `
Please analyze this project and create or update the AGENTS.md file that serves as long-term memory for this codebase.

First, check if AGENTS.md already exists and read its content. Then analyze the current project structure and:

1. Document the technology stack and key dependencies
2. Describe the project structure and architecture overview  
3. List development commands (build, test, lint, format etc.)
4. Document code style guidelines and conventions
5. Include important configuration details
6. Add any other relevant project-specific information

Generate a comprehensive, well-structured AGENTS.md file that will help future AI assistants understand and work effectively with this project.

Use the available tools to read existing files, analyze the project structure, and write the updated AGENTS.md file.
`;

    // Execute the prompt directly through the agent
    await onExecutePrompt(initPrompt.trim());
  },
};

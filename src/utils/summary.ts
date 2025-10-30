import type { LLMMessage } from "../sessions/types";

/**
 * Builds a comprehensive summary prompt from LLM messages
 * This function is shared between auto-compression and manual /compact command
 */
export function buildSummaryPrompt(llmMessages: LLMMessage[]): string {
  // Build conversation history for summarization
  const conversationText = llmMessages
    .map((msg) => {
      const role = msg.message.role;
      const content =
        typeof msg.message.content === "string" ? msg.message.content : "";
      return `<${role}>\n${content}\n</${role}>`;
    })
    .join("\n\n");

  return `
Please analyze this conversation and create a comprehensive summary that captures the key points, decisions, and context.

Conversation History:
<conversation>
${conversationText}
</conversation>

Please provide a detailed summary that includes:

1. Primary Request and Intent:
   - What the user is trying to accomplish
   - The main purpose and goals of the conversation

2. Key Technical Concepts:
   - Important technical topics, patterns, or concepts discussed
   - Architecture decisions or design patterns mentioned

3. Files and Code Sections:
   - Files that were read, examined, modified, or created
   - Important code snippets or sections discussed

4. Errors and Fixes:
   - Any errors encountered and how they were resolved
   - Debugging processes or troubleshooting steps

5. Problem Solving:
   - Problems presented and solutions implemented
   - Decision-making processes and rationale

6. All User Messages:
   - Brief overview of all user requests and inputs

7. Pending Tasks:
   - Any unfinished work or follow-up items
   - Tasks that were assigned or planned

8. Current Work:
   - What development, coding, or technical work is in progress
   - Current state of the project or task

9. Optional Next Step:
   - Suggested next actions or recommendations
   - Areas that might need further attention

If the conversation is minimal or lacks technical content, please be honest about the limitations and focus on what was actually discussed rather than making assumptions.

Provide a clear, well-structured summary that preserves important technical details and decisions made during the conversation.`;
}

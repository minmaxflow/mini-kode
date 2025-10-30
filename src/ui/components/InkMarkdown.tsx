import React from "react";
import { Box, Text } from "ink";
import { marked, Token, Tokens } from "marked";
import { getCurrentTheme } from "../theme";

export interface InkMarkdownProps {
  children: string;
}

/**
 * Simple markdown renderer for Ink using marked
 * Supports only basic formatting: bold, italic, code blocks, lists, headings, blockquotes, links
 * Does not support: tables, images, task lists, strikethrough, and other complex formats
 * Also does not support nesting of basic formats (e.g., bold inside italic, links in headers, etc.)
 */
export function InkMarkdown({ children }: InkMarkdownProps) {
  const tokens = marked.lexer(children);

  return (
    <Box flexDirection="column">
      {tokens.map((token, idx) =>
        renderToken(token, idx, idx === tokens.length - 1),
      )}
    </Box>
  );
}

function renderToken(
  token: Token,
  key: number,
  isLast: boolean = false,
): React.ReactNode {
  const marginBottom = isLast ? 0 : 1;

  switch (token.type) {
    case "heading":
      return (
        <Box key={key} marginBottom={token.depth <= 3 ? 1 : 0}>
          <Text bold>{token.text}</Text>
        </Box>
      );

    case "paragraph":
      return (
        <Box key={key} marginBottom={marginBottom}>
          <Text>{renderInlineTokens(token.tokens || [])}</Text>
        </Box>
      );

    case "code":
      return (
        <Box
          key={key}
          marginBottom={marginBottom}
          flexDirection="column"
          borderStyle="round"
          borderColor={getCurrentTheme().secondary}
          paddingX={1}
        >
          <Text color={getCurrentTheme().accent}>{token.text}</Text>
        </Box>
      );

    case "list":
      return (
        <Box key={key} marginBottom={marginBottom} flexDirection="column">
          {token.items.map((item: Tokens.ListItem, i: number) => {
            // List items can have complex nested tokens structure
            // We need to handle the case where the first token is a text token with nested tokens
            let content: React.ReactNode;

            if (
              item.tokens.length === 1 &&
              item.tokens[0].type === "text" &&
              item.tokens[0].tokens
            ) {
              // Handle nested tokens within text token
              content = renderInlineTokens(item.tokens[0].tokens);
            } else {
              // Handle simple tokens
              content = renderInlineTokens(item.tokens);
            }

            return (
              <Box key={i}>
                <Text>{token.ordered ? `${i + 1}.` : "•"} </Text>
                <Text>{content}</Text>
              </Box>
            );
          })}
        </Box>
      );

    case "blockquote":
      return (
        <Box
          key={key}
          marginBottom={marginBottom}
          borderStyle="round"
          borderColor={getCurrentTheme().secondary}
          paddingX={1}
        >
          <Text color={getCurrentTheme().secondary}>{token.text}</Text>
        </Box>
      );

    case "space":
      return <Box key={key} />;

    case "hr":
      return (
        <Box key={key} marginBottom={marginBottom} width="100%">
          <Text>
            {Array.from(
              { length: process.stdout.columns - 12 },
              () => "─",
            ).join("")}
          </Text>
        </Box>
      );

    default:
      // Fallback for unsupported token types
      if ("raw" in token) {
        return <Text key={key}>{token.raw}</Text>;
      }
      return null;
  }
}

function renderInlineTokens(tokens: Token[]): React.ReactNode {
  return tokens.map((token: Token, idx: number) => {
    switch (token.type) {
      case "text":
        // Check for interruption marker and highlight it
        // Note: This handles the "[Interrupted by User]" marker that is added
        // to the message content in toOpenAIMessages() for API context preservation
        if (token.text.includes("[Interrupted by User]")) {
          const parts = token.text.split("[Interrupted by User]");
          return (
            <React.Fragment key={idx}>
              {parts[0]}
              <Text color={getCurrentTheme().error} bold>
                [Interrupted by User]
              </Text>
              {parts[1]}
            </React.Fragment>
          );
        }
        return <React.Fragment key={idx}>{token.text}</React.Fragment>;

      case "strong":
        return (
          <Text key={idx} bold>
            {renderInlineTokens(token.tokens || [])}
          </Text>
        );

      case "em":
        return (
          <Text key={idx} italic>
            {renderInlineTokens(token.tokens || [])}
          </Text>
        );

      case "codespan":
        return (
          <Text key={idx} color={getCurrentTheme().accent}>
            {token.text}
          </Text>
        );

      case "link":
        return (
          <Text key={idx} underline color={getCurrentTheme().accent}>
            {token.text}
          </Text>
        );

      case "br":
        return <React.Fragment key={idx}>{"\n"}</React.Fragment>;

      default:
        if ("raw" in token) {
          return <React.Fragment key={idx}>{token.raw}</React.Fragment>;
        }
        return null;
    }
  });
}

export default InkMarkdown;

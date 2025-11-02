import React, { useMemo } from "react";
import { Box, Static } from "ink";

import type { PermissionOption } from "../../permissions/types";
import { isTransientToolState } from "../../tools/runner.types";
import type { ToolCall as ToolCallType } from "../../tools/runner.types";
import type { UIFeedMessage } from "../types";
import { ToolMessage } from "./ToolMessage";
import { TextMessage } from "./TextMessage";
import { CommandMessage } from "./CommandMessage";

export interface MessageFeedProps {
  messages: UIFeedMessage[];
  toolCalls: ToolCallType[];
  cwd: string;
  onApprove: (requestId: string, option: PermissionOption) => void;
  onReject: (requestId: string) => void;
  /** Static UI elements to render at the top (e.g., Logo, headers, etc.) */
  staticHeader?: React.ReactNode;
  clearNum: number;
}

export function MessageFeed({
  messages,
  toolCalls,
  cwd,
  onApprove,
  onReject,
  staticHeader,
  clearNum,
}: MessageFeedProps) {
  // Create a map for quick tool call lookup by requestId
  // toolCalls is the source of truth for tool call states and results
  const toolCallsById = useMemo(() => {
    const map = new Map<string, ToolCallType>();
    toolCalls.forEach((call) => map.set(call.requestId, call));
    return map;
  }, [toolCalls]);

  // Find the split point: first streaming assistant message or executing command
  // IMPORTANT: All messages (LLM messages and command messages) must be serialized
  // This index determines where to split between:
  // - Static area: All messages before and including non-streaming/finalized content
  // - Dynamic area: Streaming/executing message and everything after for real-time updates
  const streamingMessageIndex = useMemo(
    () =>
      messages.findIndex(
        (msg) =>
          // Streaming LLM message
          (msg.kind === "api" &&
            msg.message.role === "assistant" &&
            msg.status === "streaming") ||
          // Executing command
          (msg.kind === "cmd" && msg.status === "executing"),
      ),
    [messages],
  );

  // Split messages into static and dynamic arrays
  // Static: all messages before and including non-streaming content
  // Dynamic: streaming message and everything after
  const { staticMessageSegments, dynamicMessageSegments } = useMemo(
    () => ({
      staticMessageSegments:
        streamingMessageIndex === -1
          ? messages
          : messages.slice(0, streamingMessageIndex),
      dynamicMessageSegments:
        streamingMessageIndex === -1
          ? []
          : messages.slice(streamingMessageIndex),
    }),
    [messages, streamingMessageIndex],
  );

  // Process messages using the helper function
  const { staticMessages, dynamicMessages } = useMemo(() => {
    // Helper function to process message segments
    const processMessageSegments = (
      segments: UIFeedMessage[],
      area: "static" | "dynamic",
      displayedToolCallIds: Set<string>,
    ): React.ReactNode[] => {
      const processedMessages: React.ReactNode[] = [];

      segments.forEach((msg) => {
        const messageIndex = messages.indexOf(msg);
        const areaPrefix = area === "static" ? "static" : "dynamic";

        // Handle command messages
        if (msg.kind === "cmd") {
          processedMessages.push(
            <CommandMessage
              key={`${areaPrefix}-command-${messageIndex}`}
              commandMessage={msg}
            />,
          );
          return;
        }

        const message = msg.message;

        // User messages: only in static area
        if (message.role === "user") {
          if (area === "static") {
            processedMessages.push(
              <TextMessage
                key={`${areaPrefix}-message-${messageIndex}`}
                wrappedMessage={msg}
                index={messageIndex}
              />,
            );
          }
        }

        // Assistant messages: both areas, but filter empty content in static area
        else if (message.role === "assistant") {
          // In static area, filter out assistant messages that only have tool calls without content
          if (area === "static") {
            const hasContent =
              message.content &&
              typeof message.content === "string" &&
              message.content.trim().length > 0;

            if (hasContent) {
              processedMessages.push(
                <TextMessage
                  key={`${areaPrefix}-message-${messageIndex}`}
                  wrappedMessage={msg}
                  index={messageIndex}
                />,
              );
            }
            // If no content, skip this message (it was just a tool call placeholder)
          } else {
            // In dynamic area, show all assistant messages (including streaming ones)
            processedMessages.push(
              <TextMessage
                key={`${areaPrefix}-message-${messageIndex}`}
                wrappedMessage={msg}
                index={messageIndex}
              />,
            );
          }
        }

        // Tool result messages: both areas
        else if (message.role === "tool") {
          const toolCall = toolCallsById.get(message.tool_call_id);
          if (toolCall) {
            processedMessages.push(
              <ToolMessage
                key={`${areaPrefix}-tool-${message.tool_call_id}`}
                toolCall={toolCall}
                cwd={cwd}
                onApprove={onApprove}
                onReject={onReject}
              />,
            );
            displayedToolCallIds.add(message.tool_call_id);
          }
        }
      });

      return processedMessages;
    };

    const displayedToolCallIds = new Set<string>();
    const staticMsgs = processMessageSegments(
      staticMessageSegments,
      "static",
      displayedToolCallIds,
    );
    const dynamicMsgs = processMessageSegments(
      dynamicMessageSegments,
      "dynamic",
      displayedToolCallIds,
    );

    // Dynamic area: Currently executing tool calls that haven't completed yet
    // These tool calls exist in toolCalls array but don't have corresponding tool messages yet
    toolCalls.forEach((call) => {
      if (!displayedToolCallIds.has(call.requestId)) {
        // Only show tool calls that are still active (transient states)
        if (isTransientToolState(call.status)) {
          dynamicMsgs.push(
            <ToolMessage
              key={`dynamic-tool-${call.requestId}`}
              toolCall={call}
              cwd={cwd}
              onApprove={onApprove}
              onReject={onReject}
            />,
          );
        }
      }
    });

    return { staticMessages: staticMsgs, dynamicMessages: dynamicMsgs };
  }, [
    staticMessageSegments,
    dynamicMessageSegments,
    toolCalls,
    cwd,
    onApprove,
    onReject,
  ]);

  // Prepare static items with optional header content
  const staticItems = useMemo(() => {
    if (staticHeader) {
      return [
        React.cloneElement(staticHeader as React.ReactElement, {
          key: `static-header`,
        }),
        ...staticMessages,
      ];
    }
    return staticMessages;
  }, [staticMessages, staticHeader]);

  return (
    <Box flexDirection="column">
      {/* 
        Static area: Render completed and stable content
        Includes Logo, all user messages, completed assistant messages, and finished tool calls.
        This content won't change and benefits from:
        1. Static rendering performance - no re-renders for stable content
        2. Smooth scrolling - static elements don't shift or jitter during terminal scrolling
        
        Key: Force re-render when clearNum changes by using key prop
        - clearNum increments on /clear command to force Static component to re-mount
        - This ensures Logo and other static content are properly re-rendered after clear
      */}
      {staticItems.length > 0 && (
        <Static key={`static-${clearNum}`} items={staticItems}>
          {(item) => item}
        </Static>
      )}

      {/* 
        Dynamic area: Render content that needs real-time updates
        Includes streaming assistant messages and currently executing tool calls.
        This content changes frequently and needs to be re-rendered.
      */}
      {dynamicMessages.length > 0 && dynamicMessages}
    </Box>
  );
}

export default MessageFeed;

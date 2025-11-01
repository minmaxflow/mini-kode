/**
 * Agent Executor Tests
 *
 * Tests for the core agent execution engine.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { streamChatCompletion } from "../llm/client";
import { executeAgent } from "./executor";
import { getToolsByName } from "../tools";
import { runToolBatchConcurrent, executeSingleToolCall } from "../tools/runner";
import type { ExecutionContext, ExecutionCallbacks } from "./types";
import { createSession } from "../sessions/types";

// Mock dependencies
vi.mock("../llm/client", () => ({
  createClient: vi.fn(() => ({
    model: "test-model",
    apiKey: "test-key",
    baseURL: "https://test.api",
  })),
  streamChatCompletion: vi.fn(),
}));

vi.mock("./context", () => ({
  buildSystemMessage: vi.fn(async () => ({
    role: "system",
    content: "You are a helpful assistant.",
  })),
  isGitRepository: vi.fn(() => false),
}));

vi.mock("../tools", () => ({
  ALL_TOOLS: [],
  getAllTools: vi.fn(() => [
    { name: "fileRead", readonly: true },
    { name: "fileEdit", readonly: false },
    { name: "listFiles", readonly: true },
    { name: "grep", readonly: true },
  ]),
  getToolsByName: vi.fn(() => ({
    fileRead: { name: "fileRead", readonly: true },
    fileEdit: { name: "fileEdit", readonly: false },
    listFiles: { name: "listFiles", readonly: true },
    grep: { name: "grep", readonly: true },
  })),
}));

vi.mock("../tools/openai", () => ({
  allToolsToOpenAIFormat: vi.fn(() => []),
}));

vi.mock("../tools/runner", () => ({
  runToolBatchConcurrent: vi.fn(async function* () {
    // Default mock implementation - return success
    yield {
      toolName: "fileRead",
      requestId: "call_1",
      status: "success",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      result: { output: "default tool result" },
    };
  }),
  executeSingleToolCall: vi.fn(),
}));

describe("AgentExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeAgent", () => {
    it("should execute simple prompt with text response", async () => {
      (vi.mocked(streamChatCompletion) as any).mockImplementation(
        async function* () {
          yield {
            completeMessage: {
              role: "assistant",
              content: "Hello world",
            },
            isComplete: true,
            finishReason: "stop",
          };
        },
      );

      const session = createSession();
      const context: ExecutionContext = {
        cwd: "/test",
        getApprovalMode: () => "default",
        session,
      };

      const callbacks: ExecutionCallbacks = {
        onComplete: vi.fn(),
      };

      const result = await executeAgent("Say hello", context, callbacks);

      expect(result.success).toBe(true);
      expect(result.response).toBe("Hello world");
      expect(callbacks.onComplete).toHaveBeenCalledWith("Hello world");
    });

    describe("Tool execution scenarios", () => {
      beforeEach(() => {
        const toolsByName = getToolsByName();
        (toolsByName as any).fileRead = {
          name: "fileRead",
          description: "A test readonly tool",
          readonly: true,
          inputSchema: { parse: (v: any) => v },
          execute: vi.fn(),
        };
        (toolsByName as any).fileEdit = {
          name: "fileEdit",
          description: "A test write tool",
          readonly: false,
          inputSchema: { parse: (v: any) => v },
          execute: vi.fn(),
        };
      });

      it("should handle successful tool execution", async () => {
        // Mock successful tool execution
        vi.mocked(runToolBatchConcurrent).mockImplementation(
          async function* () {
            yield {
              toolName: "fileRead",
              requestId: "call_1",
              status: "success",
              startedAt: new Date().toISOString(),
              endedAt: new Date().toISOString(),
              input: { filePath: "/test/test.txt" },
              result: {
                type: "fileRead",
                filePath: "/test/test.txt",
                content: "file content",
                offset: 0,
                limit: 100,
                totalLines: 1,
                truncated: false,
              },
            };
          },
        );

        // Mock LLM to return tool call, then text response
        let callCount = 0;
        (vi.mocked(streamChatCompletion) as any).mockImplementation(
          async function* () {
            callCount++;

            if (callCount === 1) {
              // First call: return tool call
              yield {
                completeMessage: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "fileRead",
                        arguments: '{"path":"test.txt"}',
                      },
                    },
                  ],
                },
                parsedToolCalls: [
                  {
                    id: "call_1",
                    name: "fileRead",
                    arguments: { path: "test.txt" },
                  },
                ],
                isComplete: true,
                finishReason: "tool_calls",
              };
            } else {
              // Second call: return text response
              yield {
                completeMessage: {
                  role: "assistant",
                  content: "Done",
                },
                isComplete: true,
                finishReason: "stop",
              };
            }
          },
        );

        const session = createSession();
        const context: ExecutionContext = {
          cwd: "/test",
          getApprovalMode: () => "default",
          session,
        };

        const callbacks: ExecutionCallbacks = {
          onToolStart: vi.fn(),
          onToolComplete: vi.fn(),
        };

        const result = await executeAgent("Read file", context, callbacks);

        expect(result.success).toBe(true);
        expect(result.response).toBe("Done");
        expect(callbacks.onToolStart).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "fileRead",
            requestId: "call_1",
            status: "executing",
            input: { path: "test.txt" },
          }),
        );
        expect(callbacks.onToolComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "fileRead",
            status: "success",
            result: expect.objectContaining({
              type: "fileRead",
              content: "file content",
            }),
          }),
        );
      });

      it("should handle tool execution failure", async () => {
        // Mock tool execution failure
        vi.mocked(runToolBatchConcurrent).mockImplementation(
          async function* () {
            yield {
              toolName: "fileRead",
              requestId: "call_1",
              status: "error",
              startedAt: new Date().toISOString(),
              endedAt: new Date().toISOString(),
              input: { filePath: "/test/test.txt" },
              result: {
                isError: true,
                message: "File not found",
              },
            };
          },
        );

        // Mock LLM to return tool call, then handle error
        let callCount = 0;
        (vi.mocked(streamChatCompletion) as any).mockImplementation(
          async function* () {
            callCount++;

            if (callCount === 1) {
              yield {
                completeMessage: {
                  role: "assistant",
                  content: "I'll read the file",
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "fileRead",
                        arguments: '{"path":"test.txt"}',
                      },
                    },
                  ],
                },
                parsedToolCalls: [
                  {
                    id: "call_1",
                    name: "fileRead",
                    arguments: { path: "test.txt" },
                  },
                ],
                isComplete: true,
                finishReason: "tool_calls",
              };
            } else {
              // LLM handles the tool error and continues
              yield {
                completeMessage: {
                  role: "assistant",
                  content: "File not found, but I can help with something else",
                },
                isComplete: true,
                finishReason: "stop",
              };
            }
          },
        );

        const session = createSession();
        const context: ExecutionContext = {
          cwd: "/test",
          getApprovalMode: () => "default",
          session,
        };

        const callbacks: ExecutionCallbacks = {
          onToolComplete: vi.fn(),
        };

        const result = await executeAgent("Read file", context, callbacks);

        expect(result.success).toBe(true);
        expect(callbacks.onToolComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "fileRead",
            status: "error",
            result: {
              isError: true,
              message: "File not found",
            },
          }),
        );
      });

      it("should handle tool execution abort", async () => {
        // Mock abort tool execution
        vi.mocked(runToolBatchConcurrent).mockImplementation(
          async function* () {
            yield {
              toolName: "fileRead",
              requestId: "call_1",
              status: "abort",
              startedAt: new Date().toISOString(),
              endedAt: new Date().toISOString(),
              input: { filePath: "/test/test.txt" },
              result: {
                isError: true,
                isAborted: true,
                message: "Aborted",
              },
            };
          },
        );

        // Mock LLM to handle abort tool
        let callCount = 0;
        (vi.mocked(streamChatCompletion) as any).mockImplementation(
          async function* () {
            callCount++;

            if (callCount === 1) {
              yield {
                completeMessage: {
                  role: "assistant",
                  content: "I'll read the file",
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "fileRead",
                        arguments: '{"path":"test.txt"}',
                      },
                    },
                  ],
                },
                parsedToolCalls: [
                  {
                    id: "call_1",
                    name: "fileRead",
                    arguments: { path: "test.txt" },
                  },
                ],
                isComplete: true,
                finishReason: "tool_calls",
              };
            } else {
              yield {
                completeMessage: {
                  role: "assistant",
                  content:
                    "The operation was cancelled. Let me try a different approach.",
                },
                isComplete: true,
                finishReason: "stop",
              };
            }
          },
        );

        const session = createSession();
        const context: ExecutionContext = {
          cwd: "/test",
          getApprovalMode: () => "default",
          session,
        };

        const callbacks: ExecutionCallbacks = {
          onToolComplete: vi.fn(),
        };

        const result = await executeAgent("Read file", context, callbacks);

        // Note: In the updated architecture, tool abort status doesn't automatically
        // stop the agent in Non-Interactive mode since there's no user to trigger abort
        // The agent continues and LLM decides how to handle the aborted tool
        expect(result.success).toBe(true);
        expect(result.response).toBe(
          "The operation was cancelled. Let me try a different approach.",
        );
        expect(callbacks.onToolComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "fileRead",
            status: "abort",
          }),
        );
      });

      it("should handle permission denied for tools", async () => {
        // Mock single tool execution to return permission_required
        vi.mocked(executeSingleToolCall).mockResolvedValue({
          toolName: "fileEdit",
          requestId: "call_1",
          status: "permission_required",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          input: { filePath: "/test/file.txt" },
          uiHint: {
            kind: "fs",
            path: "/test/file.txt",
          },
        });

        // Mock runToolBatchConcurrent to return permission_denied
        vi.mocked(runToolBatchConcurrent).mockImplementation(
          async function* (batch) {
            for (const item of batch) {
              yield {
                toolName: "fileEdit",
                requestId: item.requestId,
                status: "permission_denied",
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
                input: { filePath: "/test/file.txt" },
                result: undefined,
              };
            }
          },
        );

        // Mock LLM to return tool call
        (vi.mocked(streamChatCompletion) as any).mockImplementation(
          async function* () {
            yield {
              completeMessage: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "fileEdit",
                      arguments: '{"filePath": "/test/file.txt"}',
                    },
                  },
                ],
              },
              parsedToolCalls: [
                {
                  id: "call_1",
                  name: "fileEdit",
                  arguments: { filePath: "/test/file.txt" },
                },
              ],
              isComplete: true,
              finishReason: "tool_calls",
            };
          },
        );

        const session = createSession();
        const context: ExecutionContext = {
          cwd: "/test",
          getApprovalMode: () => "default",
          session,
        };

        const callbacks: ExecutionCallbacks = {
          onPermissionRequired: vi.fn(async () => ({
            approved: false as const,
            reason: "user_rejected" as const,
          })),
        };

        const result = await executeAgent(
          "Test permission",
          context,
          callbacks,
        );

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe("permission_denied");
        expect(result.error?.message).toBe("Rejected by user");
      });

      it("should handle multiple tool calls in one iteration", async () => {
        // Mock multiple tool executions
        vi.mocked(runToolBatchConcurrent).mockImplementation(
          async function* (batch) {
            for (const item of batch) {
              yield {
                toolName: "fileRead",
                requestId: item.requestId,
                status: "success",
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
                input: { filePath: `/test/${item.requestId}.txt` },
                result: {
                  type: "fileRead",
                  filePath: `/test/${item.requestId}.txt`,
                  content: `content for ${item.requestId}`,
                  offset: 0,
                  limit: 100,
                  totalLines: 1,
                  truncated: false,
                },
              };
            }
          },
        );

        // Mock LLM to return multiple tool calls
        let callCount = 0;
        (vi.mocked(streamChatCompletion) as any).mockImplementation(
          async function* () {
            callCount++;

            if (callCount === 1) {
              yield {
                completeMessage: {
                  role: "assistant",
                  content: "I'll read multiple files",
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "fileRead",
                        arguments: '{"path":"file1.txt"}',
                      },
                    },
                    {
                      id: "call_2",
                      type: "function",
                      function: {
                        name: "fileRead",
                        arguments: '{"path":"file2.txt"}',
                      },
                    },
                  ],
                },
                parsedToolCalls: [
                  {
                    id: "call_1",
                    name: "fileRead",
                    arguments: { path: "file1.txt" },
                  },
                  {
                    id: "call_2",
                    name: "fileRead",
                    arguments: { path: "file2.txt" },
                  },
                ],
                isComplete: true,
                finishReason: "tool_calls",
              };
            } else {
              yield {
                completeMessage: {
                  role: "assistant",
                  content: "Analysis complete",
                },
                isComplete: true,
                finishReason: "stop",
              };
            }
          },
        );

        const session = createSession();
        const context: ExecutionContext = {
          cwd: "/test",
          getApprovalMode: () => "default",
          session,
        };

        const callbacks: ExecutionCallbacks = {
          onToolStart: vi.fn(),
          onToolComplete: vi.fn(),
        };

        const result = await executeAgent(
          "Read multiple files",
          context,
          callbacks,
        );

        expect(result.success).toBe(true);
        expect(result.response).toBe("Analysis complete");
        expect(callbacks.onToolStart).toHaveBeenCalledTimes(2);
        expect(callbacks.onToolComplete).toHaveBeenCalledTimes(2);
      });

      it("should handle LLM streaming abort", async () => {
        // Mock LLM streaming that throws APIUserAbortError
        const { APIUserAbortError } = await import("openai");
        const abortError = new APIUserAbortError({
          message: "LLM response generation was aborted",
        });

        (vi.mocked(streamChatCompletion) as any).mockImplementation(
          async function* () {
            yield {
              completeMessage: {
                role: "assistant",
                content: "Partial response",
              },
              isComplete: false,
            };
            // Simulate abort during streaming
            throw abortError;
          },
        );

        const session = createSession();
        const context: ExecutionContext = {
          cwd: "/test",
          getApprovalMode: () => "default",
          session,
        };

        const callbacks: ExecutionCallbacks = {
          onComplete: vi.fn(),
          onLLMMessageUpdate: vi.fn(),
          onGeneratingChange: vi.fn(),
        };

        const result = await executeAgent("Test abort", context, callbacks);

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe("aborted");
        expect(result.error?.message).toBe(
          "LLM response generation was aborted",
        );
        expect(callbacks.onLLMMessageUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: "api",
            status: "streaming",
            message: {
              role: "assistant",
              content: "Partial response",
            },
          }),
        );
        expect(callbacks.onComplete).not.toHaveBeenCalled();
        expect(callbacks.onGeneratingChange).toHaveBeenCalledWith(false);
      });
    });
  });
});

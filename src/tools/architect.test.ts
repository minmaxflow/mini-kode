import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArchitectTool } from "./architect";
import { streamChatCompletion } from "../llm/client";

describe("ArchitectTool", () => {
  beforeEach(() => {
    vi.mock("../llm/client", () => ({
      createClient: vi.fn(() => ({
        sdk: {},
        model: "test-model",
      })),
      streamChatCompletion: vi.fn(),
    }));
  });

  it("returns a plan", async () => {
    (vi.mocked(streamChatCompletion) as any).mockImplementation(
      async function* () {
        // Mock StreamingResponse format
        yield {
          completeMessage: {
            role: "assistant",
            content:
              "1) Analyze requirements and constraints\n2) Define data structures and interfaces\n3) Outline implementation steps",
          },
          isComplete: false,
        };
        yield {
          completeMessage: {
            role: "assistant",
            content:
              "1) Analyze requirements and constraints\n2) Define data structures and interfaces\n3) Outline implementation steps",
          },
          isComplete: true,
          finishReason: "stop",
        };
      },
    );

    const res = await ArchitectTool.execute(
      { prompt: "Add search feature" },
      {
        cwd: process.cwd(),
        approvalMode: "default",
        sessionId: "test-session",
      },
    );
    if ("isError" in res) throw new Error("unexpected");
    expect(res.plan.length).toBeGreaterThan(5);
    expect(res.plan).toContain("Analyze requirements");
  });
});

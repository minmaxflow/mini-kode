import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ToolCallView } from "./ToolCallView";
import { getToolResultView } from "./tool-views";
import type { ToolCall } from "../../tools/runner.types";

function make(
  base: Partial<ToolCall> & Pick<ToolCall, "toolName" | "requestId" | "status">,
): ToolCall {
  return {
    startedAt: new Date().toISOString(),
    input: {},
    ...base,
  };
}

describe("ToolCall component", () => {
  it("renders pending", () => {
    const call = make({ toolName: "grep", requestId: "p", status: "pending" });
    const { lastFrame } = render(<ToolCallView call={call} cwd="/test" />);
    expect(lastFrame()).toContain("Search");
    expect(lastFrame()).toContain("Pending");
  });

  it("renders executing", () => {
    const call = make({
      toolName: "bash",
      requestId: "e",
      status: "executing",
    });
    const { lastFrame } = render(<ToolCallView call={call} cwd="/test" />);
    expect(lastFrame()).toContain("Bash");
    expect(lastFrame()).toContain("Running");
  });

  it("renders permission_required for fs", () => {
    const call = make({
      toolName: "fileEdit",
      requestId: "perm",
      status: "permission_required",
      uiHint: {
        kind: "fs",
        path: "/tmp/x",
        message: "Missing write grant",
      },
    });
    const { lastFrame } = render(<ToolCallView call={call} cwd="/test" />);
    expect(lastFrame()).toContain("Permission required");
    expect(lastFrame()).toContain("/tmp/x");
  });

  it("renders error view", () => {
    const call = make({
      toolName: "glob",
      requestId: "err",
      status: "error",
      result: {
        isError: true,
        message: "boom",
      },
    });
    const { lastFrame } = render(<ToolCallView call={call} cwd="/test" />);
    expect(lastFrame()).toContain("boom");
  });

  it("renders success view", () => {
    const call = make({
      toolName: "listFiles",
      requestId: "ok",
      status: "success",
      result: {
        type: "listFiles",
        path: "/test",
        entries: [{ name: "file.txt", kind: "file" }],
        total: 1,
      },
    });
    const { lastFrame } = render(
      <ToolCallView
        call={call}
        cwd="/test"
        renderView={getToolResultView(call.toolName, "/test")}
      />,
    );
    expect(lastFrame()).toContain("List");
    expect(lastFrame()).toContain("1 file");
  });
});

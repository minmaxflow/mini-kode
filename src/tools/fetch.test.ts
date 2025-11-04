import { describe, it, expect, vi, beforeEach } from "vitest";
import { FetchTool } from "./fetch";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("FetchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock Response
  function createMockResponse(
    ok: boolean,
    status: number,
    statusText: string,
    contentType: string,
    textContent: string = "",
  ) {
    return Promise.resolve({
      ok,
      status,
      statusText,
      headers: {
        get: vi.fn().mockReturnValue(contentType),
      },
      text: vi.fn().mockResolvedValue(textContent),
    } as unknown as Response);
  }

  it("should have correct tool metadata", () => {
    expect(FetchTool.name).toBe("fetch");
    expect(FetchTool.displayName).toBe("Fetch");
    expect(FetchTool.readonly).toBe(true);
    expect(FetchTool.inputSchema).toBeDefined();
  });

  it("should validate URL input", () => {
    const validInput = { url: "https://example.com", maxLength: 50000 };
    const result = FetchTool.inputSchema.safeParse(validInput);
    expect(result.success).toBe(true);

    const invalidInput = { url: "not-a-url", maxLength: 50000 };
    const invalidResult = FetchTool.inputSchema.safeParse(invalidInput);
    expect(invalidResult.success).toBe(false);
  });

  it("should fetch and convert HTML content to markdown", async () => {
    mockFetch.mockReturnValue(
      createMockResponse(
        true,
        200,
        "OK",
        "text/html; charset=utf-8",
        "<h1>Hello World</h1><p>Test content</p>",
      ),
    );

    const result = await FetchTool.execute(
      { url: "https://example.com", maxLength: 50000 },
      { cwd: "/test", approvalMode: "default", sessionId: "test" },
    );

    if ("isError" in result && result.isError) {
      expect.fail(`Expected success but got error: ${result.message}`);
    }

    const success = result as any;
    expect(success.url).toBe("https://example.com");
    expect(success.mimeType).toBe("text/html");
    expect(success.content).toContain("Hello World");
    expect(success.content).toContain("Test content");
  });

  it("should return plain text content as-is", async () => {
    mockFetch.mockReturnValue(
      createMockResponse(
        true,
        200,
        "OK",
        "text/plain; charset=utf-8",
        "This is plain text content",
      ),
    );

    const result = await FetchTool.execute(
      { url: "https://example.com/file.txt", maxLength: 50000 },
      { cwd: "/test", approvalMode: "default", sessionId: "test" },
    );

    if ("isError" in result && result.isError) {
      expect.fail(`Expected success but got error: ${result.message}`);
    }

    const plainTextSuccess = result as any;
    expect(plainTextSuccess.url).toBe("https://example.com/file.txt");
    expect(plainTextSuccess.mimeType).toBe("text/plain");
    expect(plainTextSuccess.content).toBe("This is plain text content");
  });

  it("should return JSON content as-is", async () => {
    const jsonContent = '{"key": "value", "array": [1, 2, 3]}';
    mockFetch.mockReturnValue(
      createMockResponse(true, 200, "OK", "application/json", jsonContent),
    );

    const result = await FetchTool.execute(
      { url: "https://api.example.com/data.json", maxLength: 50000 },
      { cwd: "/test", approvalMode: "default", sessionId: "test" },
    );

    if ("isError" in result && result.isError) {
      expect.fail(`Expected success but got error: ${result.message}`);
    }

    const jsonSuccess = result as any;
    expect(jsonSuccess.mimeType).toBe("application/json");
    expect(jsonSuccess.content).toBe(jsonContent);
  });

  it("should reject image content", async () => {
    mockFetch.mockReturnValue(createMockResponse(true, 200, "OK", "image/png"));

    const result = await FetchTool.execute(
      { url: "https://example.com/image.png", maxLength: 50000 },
      { cwd: "/test", approvalMode: "default", sessionId: "test" },
    );

    expect("isError" in result && result.isError).toBe(true);
    if ("isError" in result && result.isError) {
      expect(result.message).toContain("not supported");
    }
  });

  it("should handle HTTP errors", async () => {
    mockFetch.mockReturnValue(
      createMockResponse(false, 404, "Not Found", "text/html"),
    );

    const result = await FetchTool.execute(
      { url: "https://example.com/not-found", maxLength: 50000 },
      { cwd: "/test", approvalMode: "default", sessionId: "test" },
    );

    expect("isError" in result && result.isError).toBe(true);
    if ("isError" in result && result.isError) {
      expect(result.message).toContain("HTTP 404: Not Found");
    }
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await FetchTool.execute(
      { url: "https://example.com", maxLength: 50000 },
      { cwd: "/test", approvalMode: "default", sessionId: "test" },
    );

    expect("isError" in result && result.isError).toBe(true);
    if ("isError" in result && result.isError) {
      expect(result.message).toContain("Failed to fetch URL");
    }
  });

  it("should validate URL scheme", async () => {
    const result = await FetchTool.execute(
      { url: "ftp://example.com", maxLength: 50000 },
      { cwd: "/test", approvalMode: "default", sessionId: "test" },
    );

    expect("isError" in result && result.isError).toBe(true);
    if ("isError" in result && result.isError) {
      expect(result.message).toContain(
        "Only HTTP and HTTPS URLs are supported",
      );
    }
  });

  it("should respect abort signal", async () => {
    const abortController = new AbortController();
    abortController.abort();

    const result = await FetchTool.execute(
      { url: "https://example.com", maxLength: 50000 },
      {
        cwd: "/test",
        approvalMode: "default",
        sessionId: "test",
        signal: abortController.signal,
      },
    );

    expect("isError" in result && result.isError).toBe(true);
    if ("isError" in result && result.isError) {
      expect(result.isAborted).toBe(true);
      expect(result.message).toBe("Aborted");
    }
  });
});

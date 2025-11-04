import { z } from "zod";
import TurndownService from "turndown";

import { 
  parseContentType, 
  isSupportedTextContent,
  isHtmlContent
} from "../utils/file-type";
import { Tool, FetchResult, ToolExecutionContext } from "./types";

const InputSchema = z.object({
  url: z.string().url().describe("The URL to fetch content from"),
});

export type FetchInput = z.infer<typeof InputSchema>;

export const FETCH_TOOL_PROMPT: string = `
Fetches web content from the specified URL and converts it to markdown format when possible.

- Supports HTML, text, JSON, XML, CSS, and JavaScript content
- Converts HTML to markdown
- Images and binary content are not supported
- Text content is returned as-is
- Returns the content with MIME type
`.trim();

export const FetchTool: Tool<FetchInput, FetchResult> = {
  name: "fetch",
  displayName: "Fetch",
  description: FETCH_TOOL_PROMPT,
  readonly: true,
  inputSchema: InputSchema,

  async execute(
    input: FetchInput,
    context: ToolExecutionContext,
  ): Promise<FetchResult> {
    if (context.signal?.aborted) {
      return {
        isError: true,
        isAborted: true,
        message: "Aborted",
      };
    }

    const { url } = input;

    // Validate URL scheme
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return {
        isError: true,
        message: "Only HTTP and HTTPS URLs are supported",
      };
    }

    if (context.signal?.aborted) {
      return {
        isError: true,
        isAborted: true,
        message: "Aborted",
      };
    }

    let isTimeout = false;

    try {
      // Fetch the URL content with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        isTimeout = true;
        controller.abort();
      }, 30000); // 30 seconds timeout

      if (context.signal) {
        context.signal.addEventListener("abort", () => {
          if (!isTimeout) {
            controller.abort();
          }
        });
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "mini-kode/0.2.0 (https://github.com/minmaxflow/mini-kode)",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          isError: true,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      if (context.signal?.aborted) {
        return {
          isError: true,
          isAborted: true,
          message: "Aborted",
        };
      }

      // Get content type header
      const contentType = response.headers.get("content-type") || "";
      const mimeType = parseContentType(contentType);

      if (!isSupportedTextContent(contentType)) {
        return {
          isError: true,
          message: `Content type ${mimeType || "unknown"} is not supported. Only text-based content can be fetched.`,
        };
      }

      // Get content as text
      const content = await response.text();

      if (context.signal?.aborted) {
        return {
          isError: true,
          isAborted: true,
          message: "Aborted",
        };
      }

      let processedContent = content;

      // Convert HTML to markdown if needed
      if (isHtmlContent(contentType)) {
        try {
          const turndownService = new TurndownService({
            headingStyle: "atx",
            bulletListMarker: "-",
            codeBlockStyle: "fenced",
            fence: "```",
          });

          processedContent = turndownService.turndown(content);
        } catch (error) {
          return {
            isError: true,
            message: `Failed to convert HTML to markdown: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      }

      return {
        url: input.url,
        content: processedContent,
        mimeType,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            isError: true,
            isAborted: true,
            message: isTimeout ? "Request timed out after 30 seconds" : "Aborted",
          };
        }
      }

      return {
        isError: true,
        message: `Failed to fetch URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
};

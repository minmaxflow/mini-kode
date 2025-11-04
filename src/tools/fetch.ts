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
  maxLength: z.number().default(50000).describe("Maximum length of content to return (default: 50000 characters)"),
});

export type FetchInput = {
  url: string;
  maxLength?: number;
};

export const FETCH_TOOL_PROMPT: string = `
Fetches text-based web content from HTTP/HTTPS URLs for analysis and information extraction.

USE THIS TOOL WHEN:
- You need to read and analyze web page content
- You need to extract information from websites
- You need to get text content from documentation, articles, or forums
- You need to analyze webpage content for any purpose

PREFER OTHER TOOLS WHEN:
- You need to interact with a specific API service
- You need to perform specific actions on a website
- You need to navigate or interact with web pages

FEATURES:
- Supports only HTTP and HTTPS protocols
- Fetches HTML, text, JSON, XML, and markdown content
- Automatically converts HTML to markdown for better readability
- Returns raw text content with MIME type information

EXAMPLE USE CASES:
- Reading Reddit posts and comments for analysis
- Extracting information from documentation pages
- Analyzing news articles or blog posts
- Getting content from forums or discussion boards
- Reading any web page for text analysis purposes
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

    const { url, maxLength = 50000 } = input;

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
      let finalMimeType = mimeType;

      // Convert HTML to markdown if needed
      if (isHtmlContent(contentType)) {
        try {
          const turndownService = new TurndownService({
            headingStyle: "atx",
            bulletListMarker: "-",
            codeBlockStyle: "fenced",
            fence: "```",
          });

          // Remove script, style, and other elements that add noise to markdown output
          turndownService.remove([
            'script',      // JavaScript code
            'style',       // CSS styles
            'iframe',      // Embedded content
            'img',         // Images (alt text is preserved)
            'video',       // Video content
            'audio',       // Audio content
            'noscript',    // Fallback content
            'canvas',      // Canvas elements
          ]);

          processedContent = turndownService.turndown(content);
          finalMimeType = "text/markdown"; // Update MIME type to markdown
        } catch (error) {
          return {
            isError: true,
            message: `Failed to convert HTML to markdown: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      }

      // Apply maxLength limit if specified
      let finalContent = processedContent;
      if (maxLength && finalContent.length > maxLength) {
        finalContent = finalContent.substring(0, maxLength) + '\n\n[Content truncated due to length limit]';
      }

      return {
        url: input.url,
        content: finalContent,
        mimeType: finalMimeType,
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

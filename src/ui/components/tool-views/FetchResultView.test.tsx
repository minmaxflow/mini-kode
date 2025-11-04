import { render } from "ink-testing-library";
import React from "react";
import { expect, test } from "vitest";

import { FetchResultView } from "./FetchResultView";
import type { FetchSuccess } from "../../../tools/types";

test("FetchResultView renders fetch result with URL", () => {
  const mockResult: FetchSuccess = {
    url: "https://example.com",
    content: "Hello World",
    mimeType: "text/plain",
  };

  const { lastFrame } = render(
    React.createElement(FetchResultView, { result: mockResult })
  );

  expect(lastFrame()).toContain("https://example.com");
  expect(lastFrame()).toContain("Hello World");
});

test("FetchResultView renders markdown content", () => {
  const mockResult: FetchSuccess = {
    url: "https://example.com",
    content: "# Hello World\n\nThis is markdown.",
    mimeType: "text/markdown",
  };

  const { lastFrame } = render(
    React.createElement(FetchResultView, { result: mockResult })
  );

  expect(lastFrame()).toContain("https://example.com");
  expect(lastFrame()).toContain("# Hello World");
  expect(lastFrame()).toContain("This is markdown.");
});

test("FetchResultView truncates long content", () => {
  const longContent = Array(10).fill("Line of content").join("\n");
  const mockResult: FetchSuccess = {
    url: "https://example.com",
    content: longContent,
    mimeType: "text/plain",
  };

  const { lastFrame } = render(
    React.createElement(FetchResultView, { result: mockResult })
  );

  expect(lastFrame()).toContain("https://example.com");
  expect(lastFrame()).toContain("Line of content");
  expect(lastFrame()).toContain("… +5 lines");
  // Should only show first 5 lines when truncated
  expect(lastFrame()).not.toContain(longContent.split("\n")[6]);
});

test("FetchResultView shows (No content) for empty content", () => {
  const mockResult: FetchSuccess = {
    url: "https://example.com",
    content: "",
    mimeType: "text/plain",
  };

  const { lastFrame } = render(
    React.createElement(FetchResultView, { result: mockResult })
  );

  expect(lastFrame()).toContain("https://example.com");
  expect(lastFrame()).toContain("(No content)");
});

test("FetchResultView shows (No content) for whitespace-only content", () => {
  const mockResult: FetchSuccess = {
    url: "https://example.com",
    content: "   \n  \n   ",
    mimeType: "text/plain",
  };

  const { lastFrame } = render(
    React.createElement(FetchResultView, { result: mockResult })
  );

  expect(lastFrame()).toContain("https://example.com");
  expect(lastFrame()).toContain("(No content)");
});

test("FetchResultView handles exactly 6 lines without truncation", () => {
  const sixLineContent = Array(6).fill("Line").join("\n");
  const mockResult: FetchSuccess = {
    url: "https://example.com",
    content: sixLineContent,
    mimeType: "text/plain",
  };

  const { lastFrame } = render(
    React.createElement(FetchResultView, { result: mockResult })
  );

  expect(lastFrame()).toContain("https://example.com");
  expect(lastFrame()).not.toContain("… +");
  expect(lastFrame()).toContain("Line");
});
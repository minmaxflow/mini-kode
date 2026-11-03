import fs from "fs";

import type { ChatCompletionMessageParam } from "openai/resources";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigManager } from "../config";
import type { GlobalConfig } from "../config/types";
import { ProjectPaths } from "../utils/paths";
import { createClient, streamChatCompletion } from "./client";

const configPath = "minimax-request-test-config.json";
const messages: (ChatCompletionMessageParam & {
  reasoning_content?: string;
})[] = [
  {
    role: "user",
    content: [
      { type: "text", text: "Describe this image" },
      {
        type: "image_url",
        image_url: { url: "https://example.com/image.png" },
      },
    ],
  },
  {
    role: "assistant",
    content: null,
    reasoning_content: "Inspect the supplied context.",
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "lookup", arguments: "{}" },
      },
    ],
  },
  { role: "tool", tool_call_id: "call_1", content: "Saved result" },
];
const tools = [
  {
    type: "function" as const,
    function: {
      name: "lookup",
      description: "Look up context",
      parameters: { type: "object", properties: {} },
    },
  },
];
let requests: Request[];
let savedConfig: GlobalConfig | undefined;

beforeEach(() => {
  for (const name of [
    "MINIKODE_API_KEY",
    "MINIKODE_BASE_URL",
    "MINIKODE_MODEL",
    "MINIKODE_PLAN_MODEL",
    "DEEPSEEK_API_KEY",
    "OPENAI_API_KEY",
    "GLM_API_KEY",
    "MINIMAX_API_KEY",
    "MINIMAX_REGION",
    "MINIMAX_MODEL",
  ]) {
    vi.stubEnv(name, undefined);
  }
  vi.stubEnv("MINIMAX_API_KEY", "test-key");
  savedConfig = undefined;
  vi.spyOn(ProjectPaths, "getGlobalConfigPath").mockReturnValue(configPath);
  const existsSync = fs.existsSync;
  const readFileSync = fs.readFileSync;
  vi.spyOn(fs, "existsSync").mockImplementation((file) =>
    file === configPath ? savedConfig !== undefined : existsSync(file),
  );
  vi.spyOn(fs, "readFileSync").mockImplementation((file, options) =>
    file === configPath
      ? JSON.stringify(savedConfig)
      : readFileSync(file, options),
  );
  requests = [];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return new Response(
        'data: {"choices":[{"index":0,"delta":{"content":"Done"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function expectRequest(
  model: string,
  baseURL: string,
  override?: string,
) {
  const client = createClient({ cwd: process.cwd(), model: override });
  const responses = [];
  for await (const response of streamChatCompletion(client, messages, {
    tools,
  })) {
    responses.push(response);
  }
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(`${baseURL}/chat/completions`);
  expect(requests[0].method).toBe("POST");
  // Exact serialized body also guards against unsupported thinking/effort fields.
  expect(await requests[0].json()).toEqual({
    model,
    messages,
    stream: true,
    tools,
  });
  expect(responses.at(-1)?.completeMessage).toEqual({
    role: "assistant",
    content: "Done",
  });
}

describe.each([
  ["global", "https://api.minimax.io/v1"],
  ["cn", "https://api.minimaxi.com/v1"],
])("MiniMax %s serialized requests", (region, baseURL) => {
  beforeEach(() => vi.stubEnv("MINIMAX_REGION", region));

  it("defaults both chat and planning to Flash", async () => {
    expect(ConfigManager.load().llm.planModel).toBe("MiniMax-M3.1-Flash");
    await expectRequest("MiniMax-M3.1-Flash", baseURL);
  });

  it.each(["MiniMax-M3", "MiniMax-M2.7", "custom-model"])(
    "preserves the explicit %s override",
    async (model) => {
      vi.stubEnv("MINIMAX_MODEL", ` ${model} `);
      expect(ConfigManager.load().llm.planModel).toBe(model);
      await expectRequest(model, baseURL);
    },
  );

  it.each(["MiniMax-M3", "MiniMax-M2.7", "custom-model"])(
    "preserves saved %s and inherits it for planning",
    async (model) => {
      savedConfig = { llm: { baseURL, model } };
      const config = ConfigManager.load();
      expect(config.llm.modelSource).toBe("global");
      expect(config.llm.planModel).toBe(model);
      expect(config.llm.planModelSource).toBe("global");
      await expectRequest(model, baseURL);
    },
  );

  it("recognizes a saved endpoint with a trailing slash", async () => {
    savedConfig = { llm: { baseURL: `${baseURL}/`, model: "MiniMax-M2.7" } };
    await expectRequest("MiniMax-M2.7", baseURL);
  });

  it("retains a separate saved planning model", async () => {
    savedConfig = {
      llm: { baseURL, model: "MiniMax-M3", planModel: "MiniMax-M2.7" },
    };
    const config = ConfigManager.load();
    expect(config.llm.planModelSource).toBe("global");
    await expectRequest("MiniMax-M2.7", baseURL, config.llm.planModel);
  });

  it("lets an explicit model override saved chat and planning models", async () => {
    savedConfig = {
      llm: { baseURL, model: "MiniMax-M2.7", planModel: "saved-plan" },
    };
    vi.stubEnv("MINIMAX_MODEL", "MiniMax-M3");
    expect(ConfigManager.load().llm.planModel).toBe("MiniMax-M3");
    await expectRequest("MiniMax-M3", baseURL);
  });

  it("does not reuse models saved for a different endpoint", async () => {
    savedConfig = {
      llm: { baseURL: "https://example.com/v1", model: "saved-custom" },
    };
    vi.stubEnv("MINIMAX_MODEL", " ");
    await expectRequest("MiniMax-M3.1-Flash", baseURL);
  });
});

it("preserves explicit custom endpoint, model and planning overrides", async () => {
  vi.stubEnv("MINIKODE_API_KEY", "custom-test-key");
  vi.stubEnv("MINIKODE_BASE_URL", "https://example.com/v1");
  vi.stubEnv("MINIKODE_MODEL", "custom-model");
  vi.stubEnv("MINIKODE_PLAN_MODEL", "custom-plan");
  expect(ConfigManager.load().llm.planModel).toBe("custom-plan");
  await expectRequest("custom-model", "https://example.com/v1");
});

it("retains a saved China endpoint and model", async () => {
  vi.stubEnv("MINIMAX_REGION", "cn");
  savedConfig = {
    llm: { baseURL: "https://api.minimaxi.com/v1", model: "MiniMax-M2.7" },
  };
  await expectRequest("MiniMax-M2.7", "https://api.minimaxi.com/v1");
});

it.each([false, true])(
  "retains streamed reasoning in the next request (tools=%s)",
  async (withTools) => {
    const chunks = [
      {
        choices: [
          {
            index: 0,
            delta: { reasoning_content: "Think " },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [
          {
            index: 0,
            delta: {
              reasoning_content: "carefully.",
              ...(withTools
                ? {
                    tool_calls: [
                      {
                        index: 0,
                        id: "call_2",
                        type: "function",
                        function: { name: "lookup", arguments: "{}" },
                      },
                    ],
                  }
                : { content: "Done" }),
            },
            finish_reason: withTools ? "tool_calls" : "stop",
          },
        ],
      },
    ];
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init));
        return new Response(
          chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
            "data: [DONE]\n\n",
          { headers: { "Content-Type": "text/event-stream" } },
        );
      },
    );
    const client = createClient();
    let assistant: ChatCompletionMessageParam | undefined;
    for await (const response of streamChatCompletion(client, messages, {
      tools,
    })) {
      assistant = response.completeMessage;
    }
    expect(assistant).toEqual({
      role: "assistant",
      content: withTools ? null : "Done",
      reasoning_content: "Think carefully.",
      ...(withTools
        ? {
            tool_calls: [
              {
                id: "call_2",
                type: "function",
                function: { name: "lookup", arguments: "{}" },
              },
            ],
          }
        : {}),
    });
    const history: ChatCompletionMessageParam[] = [...messages, assistant!];
    if (withTools)
      history.push({ role: "tool", tool_call_id: "call_2", content: "Result" });
    for await (const response of streamChatCompletion(client, history, {
      tools,
    })) {
      expect(response).toBeDefined();
    }
    expect(requests).toHaveLength(2);
    expect(await requests[1].json()).toEqual({
      model: "MiniMax-M3.1-Flash",
      messages: history,
      tools,
      stream: true,
    });
  },
);

it("keeps the existing provider auto-detection priority", async () => {
  vi.stubEnv("DEEPSEEK_API_KEY", "other-test-key");
  await expectRequest("deepseek-chat", "https://api.deepseek.com/v1");
});

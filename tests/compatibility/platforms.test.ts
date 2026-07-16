import { describe, expect, it } from "vitest";

import { createAnthropicAdapterRequest } from "@context-diet/providers-anthropic";
import { createOpenAIAdapterRequest } from "@context-diet/providers-openai";

describe("platform compatibility scaffold", () => {
  it("keeps Codex/OpenAI and Claude/Anthropic provider families represented", () => {
    expect([
      createOpenAIAdapterRequest("codex-route").provider,
      createAnthropicAdapterRequest("claude-route").provider
    ]).toEqual(["openai", "anthropic"]);
  });
});

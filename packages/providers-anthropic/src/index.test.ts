import { describe, expect, it } from "vitest";

import { createAnthropicAdapterRequest } from "./index.js";

describe("createAnthropicAdapterRequest", () => {
  it("marks requests as Anthropic provider family", () => {
    expect(createAnthropicAdapterRequest("anthropic-1").provider).toBe("anthropic");
  });
});

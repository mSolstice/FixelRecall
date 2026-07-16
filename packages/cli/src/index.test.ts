import { describe, expect, it } from "vitest";

import { describeCli } from "./index.js";

describe("describeCli", () => {
  it("names the local operator", () => {
    expect(describeCli()).toBe("context-diet local operator");
  });
});

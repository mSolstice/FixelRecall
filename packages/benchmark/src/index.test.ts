import { describe, expect, it } from "vitest";

import { benchmarkReadiness } from "./index.js";

describe("benchmarkReadiness", () => {
  it("requires a comparable baseline", () => {
    expect(benchmarkReadiness()).toEqual({ comparableBaselineRequired: true });
  });
});

import { describe, expect, it } from "vitest";

import { createSafeMetric } from "./index.js";

describe("createSafeMetric", () => {
  it("records only a metric name and numeric value", () => {
    expect(createSafeMetric("block_count", 2)).toEqual({ name: "block_count", value: 2 });
  });
});

import { describe, expect, it } from "vitest";

import { dashboardBoundary } from "./index.js";

describe("dashboardBoundary", () => {
  it("keeps raw content hidden by default", () => {
    expect(dashboardBoundary()).toEqual({ rawContentHiddenByDefault: true });
  });
});

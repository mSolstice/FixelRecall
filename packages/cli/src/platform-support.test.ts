import { describe, expect, it } from "vitest";

import {
  detectFixelRecallPlatform,
  platformSupportReport,
  renderPlatformSupportReport
} from "./platform-support.js";

describe("platform support", () => {
  it.each([
    [{ platform: "darwin" as const }, "macos"],
    [{ platform: "linux" as const, release: "6.8.0-generic" }, "linux"],
    [{ platform: "linux" as const, release: "5.15.0-microsoft-standard-WSL2" }, "wsl"],
    [{ platform: "linux" as const, env: { WSL_DISTRO_NAME: "Ubuntu" } }, "wsl"],
    [{ platform: "win32" as const }, "windows"],
    [{ platform: "aix" as const }, "unsupported"]
  ])("detects %j as %s", (input, expected) => {
    expect(detectFixelRecallPlatform(input)).toBe(expected);
  });

  it("does not overclaim unverified operating systems or native Cursor routing", () => {
    const report = platformSupportReport({ platform: "win32" });
    expect(report.capabilities.find(({ surface }) => surface === "Codex CLI")?.status).toBe(
      "validation-required"
    );
    expect(report.capabilities.find(({ surface }) => surface === "Cursor native AI")?.status).toBe(
      "unsupported"
    );
  });

  it("prints safe platform output without credentials", () => {
    const output = renderPlatformSupportReport(platformSupportReport({ platform: "darwin" }));
    expect(output).toContain("Codex IDE in VS Code: supported");
    expect(output).toContain("Credentials: not read or displayed");
    expect(output).not.toContain("sk-");
    expect(output).not.toContain("Bearer ");
  });
});

export type FixelRecallPlatform = "macos" | "linux" | "wsl" | "windows" | "unsupported";
export type PlatformSupportStatus = "supported" | "validation-required" | "unsupported";

export interface PlatformCapability {
  readonly surface: string;
  readonly status: PlatformSupportStatus;
  readonly detail: string;
}

export interface PlatformSupportReport {
  readonly platform: FixelRecallPlatform;
  readonly loopbackGateway: boolean;
  readonly capabilities: readonly PlatformCapability[];
  readonly limitations: readonly string[];
}

export interface PlatformDetectionInput {
  readonly platform: NodeJS.Platform;
  readonly release?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export function detectFixelRecallPlatform(input: PlatformDetectionInput): FixelRecallPlatform {
  if (input.platform === "darwin") return "macos";
  if (input.platform === "win32") return "windows";
  if (input.platform !== "linux") return "unsupported";

  const release = input.release?.toLowerCase() ?? "";
  const env = input.env ?? {};
  return release.includes("microsoft") || env["WSL_DISTRO_NAME"] !== undefined ? "wsl" : "linux";
}

export function platformSupportReport(input: PlatformDetectionInput): PlatformSupportReport {
  const platform = detectFixelRecallPlatform(input);
  const validated = platform === "macos";
  const configured = platform === "linux" || platform === "wsl" || platform === "windows";
  const status: PlatformSupportStatus = validated
    ? "supported"
    : configured
      ? "validation-required"
      : "unsupported";
  const common: PlatformCapability[] = [
    capability("Codex CLI", status, "Uses the user-level Codex custom provider configuration."),
    capability(
      "Claude Code CLI",
      status,
      "Uses Claude Code settings with a loopback ANTHROPIC_BASE_URL."
    ),
    capability(
      "Codex IDE in VS Code",
      status,
      "Shares the same user-level config.toml and MCP configuration as Codex CLI."
    ),
    capability(
      "Claude Code in VS Code",
      status,
      "Uses the installed Claude Code runtime and its existing settings."
    ),
    capability(
      "Codex IDE in Cursor",
      status,
      "Supported through the Codex IDE extension and shared Codex configuration."
    ),
    capability(
      "Cursor native AI",
      "unsupported",
      "Cursor does not document a local provider base URL that preserves Fixel Recall's gateway contract."
    )
  ];

  return {
    capabilities: common,
    limitations: [
      "API-key routing is required; subscription-session forwarding is not claimed.",
      "IDE support applies to the Codex and Claude Code integrations, not every editor-owned AI feature.",
      ...(validated
        ? []
        : [
            "This platform must pass its release canary and CI job before public support is claimed."
          ])
    ],
    loopbackGateway: platform !== "unsupported",
    platform
  };
}

function capability(
  surface: string,
  status: PlatformSupportStatus,
  detail: string
): PlatformCapability {
  return { detail, status, surface };
}

export function renderPlatformSupportReport(report: PlatformSupportReport): string {
  return [
    "Fixel Recall platform doctor",
    "",
    `Platform: ${report.platform}`,
    `Loopback gateway: ${report.loopbackGateway ? "available" : "unsupported"}`,
    "",
    "Surfaces:",
    ...report.capabilities.map((entry) => `- ${entry.surface}: ${entry.status} - ${entry.detail}`),
    "",
    "Limitations:",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
    "Credentials: not read or displayed"
  ].join("\n");
}

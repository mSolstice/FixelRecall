import { createHash } from "node:crypto";
import type { LocalGatewayOptions } from "@fixel-recall/proxy";

const anthropicCanaryRequest = {
  model: "claude-haiku-4-5-20251001",
  max_tokens: 32,
  messages: [
    {
      role: "user",
      content: "SYNTHETIC CANARY ONLY. Reply with exactly: Fixel Recall Claude canary passed."
    }
  ],
  stream: false
};

function canaryEvidence(request: Record<string, unknown>) {
  return {
    requestSha256: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
    inputTokenUpperBound: 200,
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 5,
    outputLimitVerified: true,
    expiresAtMs: Date.now() + 15 * 60 * 1000
  };
}

export function gatewayStartOptions(argv: readonly string[]): LocalGatewayOptions {
  const index = argv.indexOf("--codex-auth");
  const auth = index === -1 ? "api" : argv[index + 1];
  if (auth !== "api" && auth !== "subscription") {
    throw new Error("Choose --codex-auth api or --codex-auth subscription");
  }
  const canaryProviderIndex = argv.indexOf("--canary-provider");
  const canaryProvider = canaryProviderIndex === -1 ? "openai" : argv[canaryProviderIndex + 1];
  if (canaryProvider !== "openai" && canaryProvider !== "anthropic") {
    throw new Error("Choose --canary-provider openai or --canary-provider anthropic");
  }
  const canary = argv.includes("--canary")
    ? canaryProvider === "anthropic"
      ? {
          provider: "anthropic" as const,
          model: "claude-haiku-4-5-20251001",
          maxRequestBytes: 65_536,
          maxOutputTokens: 32,
          maxCostUsd: 0.1,
          evidence: canaryEvidence(anthropicCanaryRequest)
        }
      : {
          provider: "openai" as const,
          model: "gpt-6-astra",
          maxRequestBytes: 65_536,
          maxOutputTokens: 50,
          maxCostUsd: 0.1
        }
    : undefined;
  return {
    mode: "safe",
    requestTimeoutMs: 30_000,
    upstreamAllowlist:
      canaryProvider === "anthropic"
        ? ["https://api.anthropic.com"]
        : [
            ...(auth === "subscription" ? ["https://chatgpt.com"] : ["https://api.openai.com"]),
            "https://api.anthropic.com"
          ],
    upstreams: {
      anthropic: "https://api.anthropic.com/v1/messages",
      ...(canaryProvider !== "anthropic" && auth === "api"
        ? { openai: "https://api.openai.com/v1/responses" }
        : {})
    },
    ...(auth === "subscription"
      ? { codexSubscription: { baseUrl: "https://chatgpt.com/backend-api/codex" } }
      : {}),
    ...(canary === undefined ? {} : { canary })
  };
}

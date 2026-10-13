export const codexSubscriptionPaths = {
  models: "/backend-api/codex/models",
  responses: "/backend-api/codex/responses"
} as const;

/** Explicit configuration only: never choose a destination by inspecting a token. */
export function validateCodexSubscriptionBaseUrl(value: string): string {
  const url = new URL(value);
  const real = url.origin === "https://chatgpt.com";
  const local = url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (!real && !local) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, "") !== "/backend-api/codex"
  ) {
    throw new Error(
      "Codex subscription upstream must be the official backend or a loopback simulator"
    );
  }
  return `${url.origin}/backend-api/codex`;
}

export function resolveCodexSubscriptionRoute(
  method: string,
  rawUrl: string,
  baseUrl: string
): { readonly upstreamUrl: string; readonly generation: boolean } | undefined {
  const path = rawUrl.split("?")[0];
  if (method === "POST" && path === codexSubscriptionPaths.responses) {
    if (rawUrl.includes("?")) throw new Error("Unsupported subscription query");
    return { upstreamUrl: `${baseUrl}/responses`, generation: true };
  }
  if (method === "GET" && path === codexSubscriptionPaths.models) {
    const url = new URL(rawUrl, "http://127.0.0.1");
    const params = [...url.searchParams];
    if (
      params.length > 1 ||
      params.some(
        ([key, value]) => key !== "client_version" || !/^[a-zA-Z0-9._-]{1,64}$/.test(value)
      )
    ) {
      throw new Error("Unsupported subscription query");
    }
    return { upstreamUrl: `${baseUrl}/models${url.search}`, generation: false };
  }
  return undefined;
}

export function openAICanaryOutputLimit(body: Readonly<Record<string, unknown>>): unknown {
  return body["max_output_tokens"];
}

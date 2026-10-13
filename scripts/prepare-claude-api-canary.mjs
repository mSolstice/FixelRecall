// Preparation only: no networking, credential access or execution mode.
const request = {
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

if (process.argv.length !== 2) {
  console.error("Preparation only. Execution flags are not supported; no request was sent.");
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        status: "BLOCKED_PENDING_FINAL_APPROVAL",
        evidenceOrigin: "SYNTHETIC TEST DATA",
        mode: "safe",
        gateway: "http://127.0.0.1:4318",
        localPath: "/v1/messages",
        upstream: "https://api.anthropic.com/v1/messages",
        model: request.model,
        maximumTotalUsd: 0.1,
        maximumInputTokens: 200,
        maximumOutputTokens: 32,
        maximumGenerationAttempts: 1,
        automaticRetries: 0,
        request,
        pricesUsdPerMillion: { input: 1, output: 5, cacheWrite5m: 1.25, cacheRead: 0.1 },
        estimatedGenerationUpperBoundUsd: 0.00036,
        missingEvidence: [
          "Exact provider-reported input count for this request",
          "Final confirmation for this exact one-request canary",
          "Fresh account access and billing check in the operator terminal"
        ],
        credentialsRead: false,
        providerTrafficSent: false
      },
      null,
      2
    )
  );
}

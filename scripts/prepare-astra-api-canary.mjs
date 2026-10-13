// Preparation only: deliberately no networking, credential access or execution mode.
const request = {
  model: "gpt-6-astra",
  input: "SYNTHETIC CANARY ONLY. Reply with exactly: Fixel Recall real-provider canary passed.",
  max_output_tokens: 50,
  reasoning: { effort: "low" },
  service_tier: "default",
  store: false
};

if (process.argv.length !== 2) {
  console.error("Preparation only. Execution flags are not supported; no request was sent.");
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        status: "BLOCKED_PENDING_BUDGET_VERIFICATION",
        mode: "safe",
        gateway: "http://127.0.0.1:4318",
        generationPath: "/v1/responses",
        upstream: "https://api.openai.com/v1/responses",
        proposedInputCountEndpoint: "https://api.openai.com/v1/responses/input_tokens",
        maximumTotalUsd: 0.1,
        maximumInputTokens: 200,
        maximumGenerationAttempts: 1,
        automaticRetries: 0,
        request,
        missingEvidence: [
          "Verified input-token count for this exact request, including framing",
          "Verified billing bound for any token-count request plus generation",
          "Fresh pricing, model access and a tested dedicated gateway kill switch",
          "Final approval for the exact provider requests before execution"
        ],
        credentialsRead: false,
        providerTrafficSent: false
      },
      null,
      2
    )
  );
}

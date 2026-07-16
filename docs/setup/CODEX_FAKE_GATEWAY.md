# Codex Fake Gateway Setup

These notes are for the Prompt 3 transport feasibility spike only. They use fake routing and fake
credentials.

1. Start the local Context Diet fake gateway with the smoke script or a future CLI wrapper.
2. Note the loopback base URL, for example `http://127.0.0.1:4317`.
3. Configure a Codex custom provider to use that base URL for the OpenAI Responses protocol.

Illustrative project-local TOML:

```toml
model = "fake-openai-model"
model_provider = "context_diet_fake"

[model_providers.context_diet_fake]
name = "Context Diet fake gateway"
base_url = "http://127.0.0.1:4317"
env_key = "OPENAI_API_KEY"
```

Use a fake value while testing:

```bash
export OPENAI_API_KEY="fake-openai-key-for-local-routing-only"
```

Do not commit personal Codex configuration or real API keys. Restore direct routing by switching
`model_provider` back to your normal provider.

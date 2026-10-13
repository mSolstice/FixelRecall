# Fixel Recall Troubleshooting

Use this file when Fixel Recall appears unavailable, unsafe, ineffective or misconfigured.

## First checks

1. Confirm the local service status.
2. Run the repository's doctor command.
3. Confirm the host points at the expected loopback gateway.
4. Confirm the gateway points at the expected allowlisted upstream.
5. Confirm Safe, Bypass or kill-switch state.
6. Check privacy-safe error codes and structured metrics.
7. Do not enable raw-body logging.

If a user expects this skill alone to shrink the current conversation, explain that the local engine
must be configured before future provider requests can be transformed.

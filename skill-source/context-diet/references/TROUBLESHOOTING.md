# Context Diet Troubleshooting

## First checks

1. Confirm the local service is running.
2. Run `context-diet doctor`.
3. Confirm the host points at the expected local gateway.
4. Confirm the gateway points at the expected allowlisted upstream.
5. Confirm Safe or Bypass mode.
6. Check privacy-safe error codes.
7. Do not enable raw-body logging.

## Skill limitation

If a user expects the skill alone to shrink the current conversation, explain that the gateway must
be configured for future provider requests.

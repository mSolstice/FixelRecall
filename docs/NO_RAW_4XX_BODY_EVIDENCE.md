# No Raw 4xx Body Evidence

This document summarises the raw-request-body persistence regression coverage for the local gateway.

## Covered Statuses

The test suite covers these local gateway statuses:

- 400
- 401
- 403
- 404
- 409
- 413
- 415
- 422
- 429

Each status is exercised through both provider-shaped routes:

- OpenAI Responses: `/v1/responses`
- Anthropic Messages: `/v1/messages`

## Evidence Checked

For each provider and status pair, the test sends a synthetic request body containing a unique fake
canary sentence. The test then inspects safe evidence categories:

- structured logs
- trace-like timing records
- status and metrics snapshots
- temporary evidence files
- vault event placeholder
- audit event placeholder
- generated artifact placeholder

The test writes safe metadata snapshots and scans them before cleanup. The raw body and canary
sentence must not appear in any inspected evidence.

## Allowed Metadata

Only privacy-safe metadata is allowed:

- request ID
- route
- provider
- status
- error code
- byte count
- duration or timing
- booleans proving authentication values and raw bodies were not retained

## Scanner

A repository-wide canary scanner is available at:

```bash
CONTEXT_DIET_TEST_CANARIES='["synthetic canary"]' pnpm scan:test-canaries -- .
```

The automated gateway test uses generated canaries and scans the repository plus the temporary
evidence directory.

## Raw Body Logging

Raw request-body logging remains disabled. The tests do not enable raw body logging, do not persist
request bodies as fixtures, and do not include canary sentences in this document.

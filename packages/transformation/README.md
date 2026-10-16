# Opt-in Request Transformation

`createTransformationPipeline(options)` returns a function for the gateway's `transformRequest`
option. This package composes existing policy, firewall, PNG renderer, vault and provider adapters.
No transformation is enabled by default or by installing the skill. There is no automatic CLI
activation: the embedding host supplies trusted configuration and recovery authority.

The first supported shape is an array of plain string messages. Only host-classified historical user
blocks before the last two messages are eligible. Tool state, images, cache fields, unknown fields
and unsupported shapes preserve the original request. System/developer and latest turns remain
native. Responses are never rewritten.

Supply an exact provider/model binding, enabled unexpired profile, explicit evaluated literal log
templates, trusted block provenance, renderer limits, scoped vault, a recovery verification function
bound to the host MCP session, and model-specific cost estimators. Never use character counts as
real token evidence. Synthetic profiles and cost estimates in tests are not production approvals.

Log templates contain literal delimiters; gaps are exact JSON-escaped values. There is no arbitrary
regex execution or generated summary. Order, duplicates and line endings survive reconstruction.
Critical or unmatched records cause the whole log block to stay native. Approved logs are never
imaged. Eligible prose uses the existing Safe policy and PNG renderer, with an exact-recovery
sidecar. Secret-sensitive blocks are neither stored nor rendered.

Gateway transformation has a default one-second deadline, original-buffer isolation and fallback on
exceptions, invalid JSON or oversized output. Bypass, canary and subscription routes skip the hook.
Cancellation/kill switch prevents forwarding. The pipeline checks total estimated cost and wire size
before accepting a rebuilt request. A cancelled operation may leave authorised vault records until
their bounded expiry; it never deletes an entire shared session to clean up a request.

This is locally tested functionality, not evidence that a model interprets both formats equally
well. Real-model format approval and matched comprehension/cost evaluations remain necessary.

# @fixel-recall/proxy

Local gateway boundary.

The production proxy will receive host traffic, call provider adapters and forward upstream without
logging raw bodies or credentials.

Hosts may provide a dashboard renderer to expose `/dashboard` on the same loopback server. The route
receives only the gateway's safe in-memory status object: mode, kill-switch state, aggregate
transformation metadata, byte counts and recovery availability. It has no raw-context API and uses a
restrictive content security policy.

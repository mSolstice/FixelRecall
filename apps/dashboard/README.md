# @fixel-recall/dashboard

Local dashboard boundary.

The dashboard must use read-only, privacy-safe APIs and must not read raw vault files directly.

When the CLI gateway is running, open its loopback-only activity page at
`http://127.0.0.1:<port>/dashboard`. It refreshes locally and shows Safe mode, kill-switch state,
compression activity, byte counts, exact-recovery availability and the invariant that zero secrets
were rendered. It never exposes raw context or credentials.

`Compression: Pass-through` means no transformation hook is active. `Compression: Active` is shown
only when the running gateway has an enabled transformation hook and neither bypass nor the kill
switch disables it.

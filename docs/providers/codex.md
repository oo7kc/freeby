# Codex provider

UsageBeam keeps Codex account limits and local activity as separate sources.
Failure of either source does not turn missing data into zero usage.

## Account limits

The collector launches the installed Codex CLI app-server, completes its normal
initialization handshake, reads the current signed-in account, and requests
account rate limits. It supports the reported session, weekly, reserve, and
scoped quota windows without inventing windows that are absent from the response.

UsageBeam does not persist the account email or account identifier. When an
identifier is available, it is reduced to a SHA-256 fingerprint used only to
prevent cached values from crossing accounts.

The CLI is discovered from the Shell `PATH`, common user-local directories, and
fnm, nvm, mise, asdf, and Volta layouts. When a version-managed CLI requires
Node, its sibling runtime is added only to the collector process environment.

## Local activity

Codex JSONL records are scanned incrementally from `sessions/` and
`archived_sessions/` under `$CODEX_HOME` or `~/.codex`. UsageBeam reads timestamps,
models, session identifiers, and token counters. Prompt and response content is
ignored.

Cumulative counters are converted into individual deltas, including counter
reset handling. Cached-input and cache-write counters retain their own
categories. Session identifiers are hashed before derived events are persisted.

History covers the displayed period on this device. It is not account-wide
subscription usage or billable cost.

## Verification status

- Codex CLI 0.145.0: live account, quota, and local-history verification.
- Session/weekly/reserve parsing, cumulative resets, rotated/replaced records,
  duplicate events, and version-managed runtime discovery: deterministic tests.
- GNOME Shell 50 restricted-environment discovery: isolated lifecycle and
  sanitized live verification.

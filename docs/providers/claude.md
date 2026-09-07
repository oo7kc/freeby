# Claude Code provider

UsageBeam keeps Claude's account limits and local activity as separate sources.
Failure of one source does not erase valid data from the other.

## Account limits

The collector reads only the `claudeAiOauth` fields needed from
`$CLAUDE_CONFIG_DIR/.credentials.json` (or `~/.claude/.credentials.json`) and
sends the access token only to `https://api.anthropic.com/api/oauth/usage`.
It supports the current 5-hour, weekly, and model-scoped response buckets. The
token itself is never cached or logged; only a SHA-256 account fingerprint may
be retained to prevent stale data crossing accounts.

This OAuth usage interface is used by current Claude Code integrations but is
not a stable public Anthropic API contract. UsageBeam treats unknown/empty payloads
as unavailable, retains only unexpired stale windows after transient failures,
and keeps local history visible when sign-in expires or the endpoint is offline.

## Local activity

Claude Code assistant-message usage is scanned incrementally from
`$CLAUDE_CONFIG_DIR/projects/**/*.jsonl` or `~/.claude/projects/**/*.jsonl`.
UsageBeam reads timestamps, model identifiers, message/session identifiers, and the
four usage counters only. Prompt and response content is ignored.

`input_tokens`, `output_tokens`, `cache_read_input_tokens`, and
`cache_creation_input_tokens` are independent Anthropic counters, so UsageBeam adds
all four to activity totals without subtracting cache tokens from input. Repeated
message IDs are counted once. Session identifiers are hashed before derived data
is written to UsageBeam's XDG cache.

History is local to this device, covers the displayed seven-day period, and is
not a measure of subscription quota or billable cost.

## Alpha.2 verification

- Claude Code 2.1.218 installation detection and missing-auth behavior: live.
- Standard/scoped limits, percentage normalization, expired auth, endpoint auth
  errors, duplicate messages, and token categories: deterministic fixtures.
- Signed-in account quota probe: not available on the development machine.

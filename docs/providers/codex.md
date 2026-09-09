# Codex support

UsageBeam can show live Codex account limits alongside seven days of activity
recorded on the current device.

## Set up Codex

1. Install the Codex CLI.
2. Sign in with `codex login`.
3. Enable Codex in UsageBeam preferences.
4. Select **Refresh** from the UsageBeam menu.

UsageBeam recognizes standard command locations as well as common fnm, nvm,
mise, asdf, and Volta installations.

## What UsageBeam shows

- The shortest available quota window in the top panel, including when it is
  exhausted.
- Every session, weekly, reserve, or scoped limit reported for the signed-in
  account in the menu.
- A seven-day token chart and per-model totals from local Codex activity.

Account limits and local activity are independent. Local activity is not an
account-wide total, subscription quota, or billable cost.

## Privacy

UsageBeam reads only the account and usage fields needed for these views. It
does not store account email addresses, prompts, responses, credentials, or raw
session identifiers.

## If Codex shows Setup

- Confirm `codex` runs from a terminal for the same user.
- Confirm the CLI is signed in.
- Refresh UsageBeam after signing in.
- If the CLI was just installed, log out of GNOME and back in once.

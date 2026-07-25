#!/usr/bin/env bash
# copilot-setup.sh — one-time GitHub Copilot device-flow authentication
# Saves token to ~/.config/freeby/copilot-token for ai-usage.sh to read.
set -euo pipefail

CONFIG_DIR="$HOME/.config/freeby"
TOKEN_FILE="$CONFIG_DIR/copilot-token"
CLIENT_ID="Iv1.b507a08c87ecfe98"
SCOPE="read:user"

mkdir -p "$CONFIG_DIR"

if [ -f "$TOKEN_FILE" ]; then
    echo "Token already exists at $TOKEN_FILE"
    echo "Delete it and re-run to re-authenticate."
    exit 0
fi

echo "Requesting device code..."
DEVICE_RESP="$(curl -s -X POST 'https://github.com/login/device/code' \
    -H 'Accept: application/json' \
    -d "client_id=$CLIENT_ID&scope=$SCOPE")"

DEVICE_CODE="$(printf '%s' "$DEVICE_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('device_code',''))")"
USER_CODE="$(printf '%s' "$DEVICE_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('user_code',''))")"
VERIFICATION_URI="$(printf '%s' "$DEVICE_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('verification_uri',''))")"
INTERVAL="$(printf '%s' "$DEVICE_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('interval',5))")"

if [ -z "$DEVICE_CODE" ] || [ -z "$USER_CODE" ]; then
    echo "Failed to get device code. Response:"
    printf '%s\n' "$DEVICE_RESP"
    exit 1
fi

echo ""
echo "1. Go to: $VERIFICATION_URI"
echo "2. Enter code: $USER_CODE"
echo ""
echo "Waiting for authentication..."

while true; do
    sleep "$INTERVAL"
    TOKEN_RESP="$(curl -s -X POST 'https://github.com/login/oauth/access_token' \
        -H 'Accept: application/json' \
        -d "client_id=$CLIENT_ID&device_code=$DEVICE_CODE&grant_type=urn:ietf:params:oauth:grant-type:device_code")"

    TOKEN="$(printf '%s' "$TOKEN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))")"
    ERROR="$(printf '%s' "$TOKEN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error',''))")"

    if [ -n "$TOKEN" ]; then
        printf '%s' "$TOKEN" > "$TOKEN_FILE"
        chmod 600 "$TOKEN_FILE"
        echo "Token saved to $TOKEN_FILE"
        exit 0
    fi

    if [ "$ERROR" != "authorization_pending" ]; then
        echo "Error: $ERROR"
        printf '%s\n' "$TOKEN_RESP"
        exit 1
    fi
done

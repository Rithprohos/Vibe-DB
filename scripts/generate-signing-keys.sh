#!/bin/bash

set -e

echo "Generating Tauri signing keys..."

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KEYS_DIR="$ROOT_DIR/.tauri-keys"

mkdir -p "$KEYS_DIR"

echo ""
echo "This will generate a keypair using Tauri CLI."
echo "Keys will be saved to: $KEYS_DIR"
echo ""
echo "Run: bunx tauri signer generate -w $KEYS_DIR"
echo ""
echo "After generation:"
echo "1. Add private key to GitHub Secrets: TAURI_SIGNING_PRIVATE_KEY"
echo "2. Update src-tauri/tauri.conf.json plugins.updater.pubkey with the public key"
echo ""
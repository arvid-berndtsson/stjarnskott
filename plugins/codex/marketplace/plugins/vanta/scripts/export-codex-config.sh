#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$REPO_ROOT"
node --experimental-transform-types plugins/codex/src/cli.ts export --manifest plugins/codex/services.vanta.json
echo
echo "If exportable MCP servers were found, install the managed block with:"
echo "  node --experimental-transform-types plugins/codex/src/cli.ts install"

#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MANIFEST="platforms/codex/services.json"

cd "$REPO_ROOT"

echo "Exporting Codex MCP config from $MANIFEST"
node --experimental-transform-types platforms/codex/src/cli.ts export --manifest "$MANIFEST"

echo
echo "Installing managed MCP block into your Codex config"
node --experimental-transform-types platforms/codex/src/cli.ts install

echo
echo "Done. Restart Codex or open a new session to reload MCP servers."
echo "To add the Stjarnskott marketplace in Codex, either:"
echo "  - use platforms/codex/marketplace/ as a local folder source"
echo "  - or use this repository as the source and set Sparse paths to platforms/codex/marketplace"
echo "In the Codex plugin store, the shared marketplace now exposes these plugin choices:"
echo "  - Burp"
echo "  - Vanta"
echo "Plugin selection happens in the Codex plugin store; this script just installs the shared MCP config for the workspace."
echo "To remove this managed setup later, run ./platforms/codex/scripts/uninstall.sh"

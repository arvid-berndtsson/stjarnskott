#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MANIFEST="codex/services.json"

cd "$REPO_ROOT"

echo "Exporting Codex MCP config from $MANIFEST"
node --experimental-transform-types codex/src/cli.ts export --manifest "$MANIFEST"

echo
echo "Installing managed MCP block into your Codex config"
node --experimental-transform-types codex/src/cli.ts install

echo
echo "Done. Restart Codex or open a new session to reload MCP servers."
echo "To add the Stjarnskott marketplace in Codex, either:"
echo "  - use the repository root as a local folder source"
echo "  - or use this repository as the source and leave Sparse paths empty"
echo "In the Codex plugin store, the shared marketplace now exposes these plugin choices:"
echo "  - Burp"
echo "  - Vanta"
echo "Plugin selection happens in the Codex plugin store; this script just installs the shared MCP config for the workspace."
echo "To remove this managed setup later, run ./codex/scripts/uninstall.sh"

#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "Removing Stjarnskott-managed Codex MCP config and plugin entries"
node --experimental-transform-types codex/src/cli.ts uninstall

echo
echo "Done. If Codex still shows the Stjarnskott marketplace in the UI, remove or refresh that marketplace source from Codex settings."

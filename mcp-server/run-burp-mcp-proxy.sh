#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_BURP_APP="/Applications/Burp Suite Community Edition.app"
BURP_APP_PATH="${BURP_APP_PATH:-$DEFAULT_BURP_APP}"
BURP_JAVA="${BURP_JAVA_PATH:-$BURP_APP_PATH/Contents/Resources/jre.bundle/Contents/Home/bin/java}"
PROXY_JAR="$SCRIPT_DIR/libs/mcp-proxy-all.jar"
SSE_URL="${1:-${BURP_MCP_SSE_URL:-http://127.0.0.1:9876}}"

if [[ ! -x "$BURP_JAVA" ]]; then
  echo "Burp Java runtime not found at: $BURP_JAVA" >&2
  echo "Set BURP_APP_PATH or BURP_JAVA_PATH before running this script." >&2
  exit 1
fi

if [[ ! -f "$PROXY_JAR" ]]; then
  echo "Proxy jar not found at: $PROXY_JAR" >&2
  echo "Build or place mcp-proxy-all.jar under mcp-server/libs/ before running this script." >&2
  exit 1
fi

exec "$BURP_JAVA" -jar "$PROXY_JAR" --sse-url "$SSE_URL"

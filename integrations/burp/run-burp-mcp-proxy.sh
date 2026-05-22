#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_JAR="$SCRIPT_DIR/build/generated/proxy/mcp-proxy-all.jar"
SSE_URL="${1:-${BURP_MCP_SSE_URL:-http://127.0.0.1:9876}}"

discover_burp_app() {
  local app_path
  local app_dir

  for app_path in \
    "$(mdfind "kMDItemFSName == 'Burp Suite.app'c" | head -n 1)" \
    "$(mdfind "kMDItemFSName == 'Burp Suite Community Edition.app'c" | head -n 1)"
  do
    if [[ -n "$app_path" && -d "$app_path" ]]; then
      printf '%s\n' "$app_path"
      return 0
    fi
  done

  for app_dir in /Applications "$HOME/Applications"; do
    for app_path in \
      "$app_dir/Burp Suite.app" \
      "$app_dir/Burp Suite Community Edition.app"
    do
      if [[ -d "$app_path" ]]; then
        printf '%s\n' "$app_path"
        return 0
      fi
    done
  done

  return 1
}

if [[ -n "${BURP_JAVA_PATH:-}" ]]; then
  BURP_JAVA="$BURP_JAVA_PATH"
else
  BURP_APP_PATH="${BURP_APP_PATH:-$(discover_burp_app || true)}"
  BURP_JAVA="${BURP_APP_PATH:+$BURP_APP_PATH/Contents/Resources/jre.bundle/Contents/Home/bin/java}"
fi

if [[ ! -x "$BURP_JAVA" ]]; then
  echo "Burp Java runtime not found." >&2
  if [[ -n "${BURP_APP_PATH:-}" ]]; then
    echo "Looked for Burp under: $BURP_APP_PATH" >&2
  fi
  echo "Set BURP_APP_PATH or BURP_JAVA_PATH before running this script." >&2
  exit 1
fi

if [[ ! -f "$PROXY_JAR" ]]; then
  echo "Proxy jar not found at: $PROXY_JAR" >&2
  echo "Run 'cd \"$SCRIPT_DIR\" && ./gradlew syncProxyJar' before running this script." >&2
  exit 1
fi

exec "$BURP_JAVA" -jar "$PROXY_JAR" --sse-url "$SSE_URL"

# Burp MCP Setup

This setup is not fully automatic.

This repository can launch Burp's extracted MCP proxy JAR for Codex, but you still need to prepare Burp itself first.

## What You Need To Do In Burp

1. Open Burp Suite.
2. Load the Burp MCP extension if it is not already loaded.
3. Open the extension's `MCP` tab.
4. Enable the MCP server.
5. Confirm the listener host and port.
   - The common local default used in this repo is `http://127.0.0.1:9876` or `http://127.0.0.1:9876/sse`.
6. In the extension `Installation` section, click `Extract server proxy jar`.

That extract step is important. This repo now expects Burp to provide the proxy JAR rather than building and vendoring it here.

## What This Repository Uses

By default, this repo launches Burp's extracted proxy JAR from Burp's normal local location:

- macOS / Linux: `~/.BurpSuite/mcp-proxy/mcp-proxy-all.jar`
- Windows: `%APPDATA%/BurpSuite/mcp-proxy/mcp-proxy-all.jar`

If the JAR was saved somewhere else, set:

```bash
export BURP_MCP_PROXY_JAR="/path/to/mcp-proxy-all.jar"
```

If Burp needs a specific Java binary, you can also set:

```bash
export BURP_JAVA_PATH="/path/to/java"
```

## Recommended Codex Setup

After extracting the proxy JAR from Burp:

```bash
node --experimental-transform-types codex/src/cli.ts export --manifest codex/services.burp.json
node --experimental-transform-types codex/src/cli.ts install
```

If you want Burp managed for the current session:

```bash
node --experimental-transform-types codex/src/cli.ts start --manifest codex/services.burp.json
```

## How It Works

The Burp service in this repo launches:

- `plugins/burp/scripts/launch-burp-proxy.mjs`

That script:

- reads `BURP_MCP_SSE_URL` if set
- finds Burp's extracted `mcp-proxy-all.jar`
- runs `java -jar ... --sse-url ...`

## Quick Verification

1. Keep Burp open.
2. Make sure the MCP listener is enabled in Burp.
3. Make sure you already clicked `Extract server proxy jar`.
4. Run:

```bash
node --experimental-transform-types codex/src/cli.ts export --manifest codex/services.burp.json
```

5. Check `generated/codex/status.json` and `generated/codex/logs/burp.stderr.log`.

## Troubleshooting

- If Codex cannot find the proxy JAR, extract it again from Burp or set `BURP_MCP_PROXY_JAR`.
- If the proxy starts but Burp is unreachable, verify the listener in Burp matches the `BURP_MCP_SSE_URL` value.
- If Java cannot be found, set `BURP_JAVA_PATH`.

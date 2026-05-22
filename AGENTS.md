# Stjarnskott Workspace Notes

This workspace is a shared security-tooling workbench. `mcp-server/` is currently one module, and more tools, scripts, and custom integrations may be added over time.

## Repository Rules

- Treat this repository as shareable by default, even when private.
- Do not commit secrets, tokens, session material, certificates, customer data, or machine-specific configuration.
- Do not hardcode absolute local paths in tracked files. Use relative paths, environment variables, or documented setup steps instead.
- Keep licensed apps and generated binaries out of git unless there is an explicit reason to vendor them.

## Current Burp MCP Module

- Module source: `mcp-server/`
- Burp extension JAR output: `mcp-server/build/libs/burp-mcp-all.jar`
- MCP stdio proxy JAR staging path: `mcp-server/build/generated/proxy/mcp-proxy-all.jar`
- Proxy launcher script: `mcp-server/run-burp-mcp-proxy.sh`

## Build Notes

The Burp MCP extension can be rebuilt from `mcp-server/` with:

```zsh
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
cd mcp-server
./gradlew embedProxyJar
```

To stage the stdio proxy JAR for local runs:

```zsh
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
cd mcp-server
./gradlew syncProxyJar
```

## Local Setup Expectations

- `BURP_APP_PATH` may be set to override the Burp app location.
- `BURP_JAVA_PATH` may be set to point directly to Burp's Java runtime.
- `BURP_MCP_SSE_URL` may be set to override the default listener URL.

## Burp Setup

1. Launch Burp Suite Community Edition.
2. Open `Extensions`.
3. Click `Add`.
4. Set `Extension type` to `Java`.
5. Select `mcp-server/build/libs/burp-mcp-all.jar`.
6. Open the `MCP` tab added by the extension.
7. Enable the MCP server.
8. Leave the listener on `http://127.0.0.1:9876` unless there is a port conflict.

## Run The MCP Proxy

From the repository root:

```zsh
cd mcp-server
./gradlew syncProxyJar
cd ..
./mcp-server/run-burp-mcp-proxy.sh
```

To use a different listener URL:

```zsh
BURP_MCP_SSE_URL="http://127.0.0.1:9876/sse" ./mcp-server/run-burp-mcp-proxy.sh
```

## Notes

- Burp Suite Community Edition can host the MCP extension, but Community feature limits still apply.
- A VM or Kali/Parrot container is not required for this setup on macOS.

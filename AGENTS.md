# Stjarnskott Workspace Notes

This workspace is a shared security-tooling workbench organized as a small monorepo. `integrations/` contains MCP-specific modules, `packages/` contains shared launcher and workflow logic, and more tools, scripts, and custom integrations may be added over time.

## Repository Rules

- Treat this repository as shareable by default, even when private.
- Do not commit secrets, tokens, session material, certificates, customer data, or machine-specific configuration.
- Do not hardcode absolute local paths in tracked files. Use relative paths, environment variables, or documented setup steps instead.
- Keep licensed apps and generated binaries out of git unless there is an explicit reason to vendor them.

## Current Burp MCP Module

- Module source: `integrations/burp/`
- Burp extension JAR output: `integrations/burp/build/libs/burp-mcp-all.jar`
- MCP stdio proxy JAR staging path: `integrations/burp/build/generated/proxy/mcp-proxy-all.jar`
- Proxy launcher script: `integrations/burp/run-burp-mcp-proxy.sh`

## Current Vanta MCP Integration

- Shared manifest entry: `codex-workbench.services.json`
- Vanta-only manifest entry: `codex-workbench.vanta.services.json`
- Service kind: `remote-http`
- Default US endpoint: `https://mcp.vanta.com/mcp`
- EU endpoint: `https://mcp.eu.vanta.com/mcp`
- AUS endpoint: `https://mcp.aus.vanta.com/mcp`
- The shared manifest keeps Vanta disabled by default unless an operator explicitly enables it.

## Plugin Bundles

- `codex-marketplace/plugins/burp/`
  Burp-only Codex plugin bundle and Burp MCP helper server for the published marketplace source.
- `codex-marketplace/plugins/vanta/`
  Vanta-only Codex plugin bundle with setup guidance and Vanta export helper for the published marketplace source.
- `codex-marketplace/.agents/plugins/marketplace.json`
  Tracked Codex marketplace manifest for repo and local-folder installs.
- `codex-marketplace/`
  Dedicated marketplace source root. In Codex, use this folder directly as a local marketplace source, or use it as the `Sparse paths` value when adding this repository as a Git marketplace source.
- `plugins/stjarnskott/`
  Combined convenience bundle for operators who want both Burp and Vanta.

## Setup Scripts

- `scripts/setup-codex.sh`
  Exports and installs the shared Codex setup for this workspace.
- `scripts/uninstall-codex.sh`
  Removes the Stjarnskott-managed Codex MCP block, `@stjarnskott` plugin entries, and Stjarnskott plugin cache from the local Codex setup.

## Shared Workspace Packages

- Launcher/control plane: `packages/launcher/`
- Shared workflow/reporting logic: `packages/security-workflows/`
- Root CLI compatibility wrapper: `src/cli.ts`

## Build Notes

The Burp MCP extension can be rebuilt from `integrations/burp/` with:

```zsh
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
cd integrations/burp
./gradlew embedProxyJar
```

To stage the stdio proxy JAR for local runs:

```zsh
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
cd integrations/burp
./gradlew syncProxyJar
```

## Local Setup Expectations

- `BURP_APP_PATH` may be set to override the Burp app location.
- `BURP_JAVA_PATH` may be set to point directly to Burp's Java runtime.
- `BURP_MCP_SSE_URL` may be set to override the default listener URL.
- Vanta uses Codex-managed OAuth after install and does not require a local proxy script in this repo.

## Burp Setup

1. Launch Burp Suite Community Edition.
2. Open `Extensions`.
3. Click `Add`.
4. Set `Extension type` to `Java`.
5. Select `integrations/burp/build/libs/burp-mcp-all.jar`.
6. Open the `MCP` tab added by the extension.
7. Enable the MCP server.
8. Leave the listener on `http://127.0.0.1:9876` unless there is a port conflict.

If the goal is to let Codex operate Burp with minimal or no Burp UI interaction after setup, also do this in the `MCP` tab:

1. Turn on `Always allow HTTP history access`.
2. Add intended hosts under `Auto-Approved HTTP Targets`.
   Example: `example.com`
3. For hands-off request automation, either disable `Require approval for HTTP requests` or rely on `Auto-Approved HTTP Targets`.

Important nuance:

- Seeing the extension under `Extensions > Installed` only proves the JAR loaded.
- The `MCP` tab controls whether the listener is actually enabled and whether history/request actions can run unattended.

## Run The MCP Proxy

From the repository root:

```zsh
cd integrations/burp
./gradlew syncProxyJar
cd ..
./integrations/burp/run-burp-mcp-proxy.sh
```

To use a different listener URL:

```zsh
BURP_MCP_SSE_URL="http://127.0.0.1:9876" ./integrations/burp/run-burp-mcp-proxy.sh
```

## Vanta Setup

1. Prefer the Vanta-only manifest `codex-workbench.vanta.services.json` when the operator only wants Vanta.
2. If using the combined manifest, open `codex-workbench.services.json` and set the `vanta` service `enabled` field to `true`.
3. If needed, replace the default US endpoint with the EU or AUS endpoint for the tenant region.
4. Run the matching export command for the selected manifest.
5. Run `node --experimental-transform-types src/cli.ts install`.
6. Restart Codex or open a new session.
7. Complete the OAuth flow for `vanta` when Codex prompts for authentication, often from Codex settings.

## Codex Uninstall

1. Run `./scripts/uninstall-codex.sh` from the repository root to remove the Stjarnskott-managed MCP block, installed `@stjarnskott` plugin entries, and cached Stjarnskott plugin bundle from the local Codex setup.
2. If the Codex UI still shows the Stjarnskott marketplace source afterward, remove or refresh that marketplace entry from Codex settings.

## Marketplace Source Setup

When documenting or configuring the public marketplace source for Codex:

1. Local-folder source: point Codex at `codex-marketplace/`.
2. Git source: use the repository URL and set `Sparse paths` to `codex-marketplace`.
3. Keep plugin `source.path` entries relative to the marketplace source root as `./plugins/<plugin-name>`.

## Vanta Access Notes

- Vanta MCP currently requires a Vanta Admin role.
- This integration is remote-only, so agents should not try to build or launch a local Vanta MCP proxy unless a new adapter is intentionally added later.
- Do not commit Vanta credentials, exported tokens, or copied tenant-specific OAuth material into the repository.

## Notes

- Burp Suite Community Edition can host the MCP extension, but Community feature limits still apply.
- A VM or Kali/Parrot container is not required for this setup on macOS.

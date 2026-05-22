# Stjarnskott

This workspace is now structured as a Codex-first multi-MCP monorepo for local security workflows.

## Load This In Burp

- Burp extension JAR: `integrations/burp/build/libs/burp-mcp-all.jar`
- Burp proxy launcher: `integrations/burp/run-burp-mcp-proxy.sh`

## Burp Hands-Off Setup

If you want Burp to be usable from Codex without repeated manual approval inside Burp, do this one-time setup after loading the extension:

1. Open the `MCP` tab added by the extension.
2. Turn `Enabled` on.
3. Leave `Server host` as `127.0.0.1` and `Server port` as `9876` unless you have a port conflict.
4. Turn on `Always allow HTTP history access`.
5. Add your intended hosts under `Auto-Approved HTTP Targets`.
   Example: `example.com`
6. If you want Codex to send requests through Burp without Burp-side prompts, either disable `Require approval for HTTP requests` or keep it on and rely on `Auto-Approved HTTP Targets`.

Important:

- `Extensions > Installed` only confirms the JAR loaded.
- The `MCP` tab controls whether the server is actually running and whether Codex can use it unattended.

## Repository Layout

- `integrations/` contains MCP-specific modules such as Burp.
- `packages/launcher/` contains launcher, export/install, manifest, and CLI orchestration code.
- `packages/security-workflows/` contains shared workflow, findings, active/passive analysis, and reporting logic.
- `plugins/` contains internal and convenience Codex bundles that are not the public marketplace source.
- `codex-marketplace/` contains the publishable Codex marketplace source root.
- `docs/specs/` and `docs/tasks/` contain tracked specs and multi-agent work queues.

## Plugin Choices

- `Burp`
  - Burp-only plugin bundle
  - uses `codex-workbench.burp.services.json`
- `Vanta`
  - Vanta-only plugin bundle
  - uses `codex-workbench.vanta.services.json`

The tracked marketplace source root lives at `codex-marketplace/`.
Its marketplace manifest is `codex-marketplace/.agents/plugins/marketplace.json`, and its public plugin bundles live under `codex-marketplace/plugins/`.

This follows Codex marketplace conventions for repo and local-folder sources:

- the marketplace source root contains `.agents/plugins/marketplace.json`
- plugin entries point to `./plugins/<plugin-name>` relative to that source root

To add this marketplace in Codex:

- Local folder source: use `codex-marketplace/`
- Git repo source: use this repository and set `Sparse paths` to `codex-marketplace`

## Commands

- `npm run export:codex`
  - Validates the enabled services in `codex-workbench.services.json`
  - Starts local services when needed, includes remote MCP services directly, and writes Codex-ready artifacts under `generated/codex`
- `node --experimental-transform-types packages/launcher/src/cli.ts export --manifest codex-workbench.burp.services.json`
  - Exports only the Burp MCP setup
- `node --experimental-transform-types packages/launcher/src/cli.ts export --manifest codex-workbench.vanta.services.json`
  - Exports only the Vanta MCP setup
- `./scripts/setup-codex.sh`
  - Exports and installs the shared workspace MCP setup
- `./scripts/uninstall-codex.sh`
  - Removes the Stjarnskott-managed MCP block, installed `@stjarnskott` plugin entries, and the local Stjarnskott plugin cache from Codex
- `npm run start:mcps`
  - Starts enabled services and keeps the ready ones running until you stop the command
- `node --experimental-transform-types src/cli.ts install`
  - Uses the root compatibility wrapper to merge the generated managed MCP block into your Codex config file
- `node --experimental-transform-types src/cli.ts workflow --target https://example.com`
  - Uses the root compatibility wrapper and writes findings artifacts under `generated/codex/workflow`

## Generated files

- `generated/codex/mcp-servers.toml`
- `generated/codex/stjarnskott.config.toml`
- `generated/codex/status.json`

## Configured services

- `burp`
  - launches `./integrations/burp/run-burp-mcp-proxy.sh`
  - expects Burp to already be running with the MCP extension enabled at `http://127.0.0.1:9876`
  - works best after the one-time MCP tab setup above so Codex can read history and send requests without manual Burp approvals
- `vanta`
  - optional remote HTTP MCP service for Vanta
  - defaults to the US endpoint `https://mcp.vanta.com/mcp`
  - stays disabled by default so the shared manifest does not assume every operator has Vanta Admin access

## Vanta setup

1. Install the `Vanta` plugin from the repo marketplace if you want the Vanta-focused Codex surface.
2. If you want a Vanta-only MCP export, use `codex-workbench.vanta.services.json`.
3. If you want the shared workspace setup, edit `codex-workbench.services.json` and set `"enabled": true` for the `vanta` service.
4. If your Vanta tenant is not in the US, change the `url` to your regional endpoint:
   - EU: `https://mcp.eu.vanta.com/mcp`
   - AUS: `https://mcp.aus.vanta.com/mcp`
5. Run the matching export command, or use `./scripts/setup-codex.sh` if you want the shared workspace setup.
6. Run `node --experimental-transform-types src/cli.ts install` if you did not use the setup script.
7. Restart Codex or open a new session, then authenticate the `vanta` MCP server when Codex prompts for OAuth.

## Marketplace setup

Use the Add marketplace dialog in Codex like this:

- `Source`
  - local folder: `codex-marketplace`
  - GitHub or Git URL: this repository
- `Git ref`
  - usually `main`
- `Sparse paths`
  - `codex-marketplace`

Vanta MCP currently requires a Vanta Admin role. This integration uses the remote MCP server directly, so it does not need a local proxy script in this repo.

## Plugin Workflow Tools

The `Burp` plugin exposes workflow-oriented MCP tools in Codex:

- `stjarnskott:burp-summarize-history`
- `stjarnskott:burp-discover-surface`
- `stjarnskott:burp-run-active-checks`
- `stjarnskott:burp-workflow`
- `stjarnskott:burp-generate-report`

The naming convention is now `stjarnskott:<platform>-<action>`, so future integrations can follow the same shape, such as `stjarnskott:vanta-*` or `stjarnskott:pentest-tools-*`.

The full workflow writes JSON and Markdown findings artifacts under `generated/codex/workflow`.

# Stjarnskott

This repository is a Codex marketplace source for internal security and compliance plugins.

## Use It In Codex

Add the marketplace from:

- local folder: repository root
- Git source: this repository
  - `Git ref`: usually `main`
  - leave `Sparse paths` empty

The marketplace currently exposes:

- `Burp`
- `Vanta`

`Vanta` now includes a plugin-local remote MCP definition with the EU endpoint as its default.

## Codex Paths

- Marketplace source root: repository root via `.agents/plugins/marketplace.json`
- Shared Codex services: `codex/services.json`
- Burp-only services: `codex/services.burp.json`
- Vanta-only services: `codex/services.vanta.json`
- Codex CLI wrapper: `codex/src/cli.ts`
- Codex setup script: `codex/scripts/setup.sh`
- Codex uninstall script: `codex/scripts/uninstall.sh`

## Commands

```bash
./codex/scripts/setup.sh
./codex/scripts/uninstall.sh
npm test
```

Common Vanta endpoints:

- EU default: `https://mcp.eu.vanta.com/mcp`
- US: `https://mcp.vanta.com/mcp`
- AUS: `https://mcp.aus.vanta.com/mcp`

If someone needs a different Vanta region than the default EU endpoint, update `codex/services.json` or `codex/services.vanta.json` before running setup/export.

The Vanta marketplace plugin itself also points at the EU endpoint by default through `plugins/vanta/.mcp.json`.

## Repo Layout

- `.agents/plugins/marketplace.json` makes the repository root a Codex marketplace.
- `plugins/` contains the installable Codex plugin bundles.
- `codex/` contains the shared Codex support files, manifests, and setup scripts.
- `packages/` contains shared launcher and workflow code that can be reused by future platform targets.
- `integrations/` contains local integration-specific assets such as the Burp adapter.

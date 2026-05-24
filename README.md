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
- `ZAP`

`Vanta` now includes a plugin-local remote MCP definition with the EU endpoint as its default.

## Codex Paths

- Marketplace source root: repository root via `.agents/plugins/marketplace.json`
- Shared Codex services: `codex/services.json`
- Burp-only services: `codex/services.burp.json`
- Vanta-only services: `codex/services.vanta.json`
- ZAP-only services: `codex/services.zap.json`
- Codex CLI wrapper: `codex/src/cli.ts`
- Codex setup script: `codex/scripts/setup.sh`
- Codex uninstall script: `codex/scripts/uninstall.sh`

## Commands

```bash
./codex/scripts/setup.sh
./codex/scripts/uninstall.sh
npm run prepare:zap -- --url https://127.0.0.1:8282 --security-key "$ZAP_MCP_SECURITY_KEY" --install
npm test
```

For Burp, use Burp's own `Extract server proxy jar` action once, then let this repo launch that extracted proxy for Codex.

Common Vanta endpoints:

- EU default: `https://mcp.eu.vanta.com/mcp`
- US: `https://mcp.vanta.com/mcp`
- AUS: `https://mcp.aus.vanta.com/mcp`

If someone needs a different Vanta region than the default EU endpoint, update `codex/services.json` or `codex/services.vanta.json` before running setup/export.

The Vanta marketplace plugin itself also points at the EU endpoint by default through `plugins/vanta/.mcp.json`.

The ZAP marketplace plugin points at the local MCP Integration add-on default port over HTTP through `plugins/zap/.mcp.json`. If you keep ZAP's default security settings enabled, update the URL to `https://127.0.0.1:8282` or `https://localhost:8282`, trust the ZAP root CA as needed, and include the security key in the `Authorization` header.

Recommended setup for ZAP in this repo:

- install OWASP ZAP and the `MCP Integration` add-on in ZAP
- enable it in `Options -> MCP Integration`
- run `npm run prepare:zap -- --url https://127.0.0.1:8282 --security-key "$ZAP_MCP_SECURITY_KEY" --install`
- if the health check reports certificate issues, either trust the ZAP root CA or retry with local HTTP for development

Detailed ZAP setup instructions live in [instructions/owasp-zap-mcp.md](/Users/arvid/.codex/worktrees/fab6/stjarnskott/instructions/owasp-zap-mcp.md).

## Repo Layout

- `.agents/plugins/marketplace.json` makes the repository root a Codex marketplace.
- `plugins/` contains the installable Codex plugin bundles.
- `codex/` contains the shared Codex support files, manifests, and setup scripts.
- `instructions/` contains focused setup guides that would otherwise make the main README too long.
- `packages/` contains shared launcher and workflow code that can be reused by future platform targets.

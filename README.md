# Stjarnskott

This repository is a Codex marketplace source for internal security and compliance plugins.

## Use It In Codex

Add the marketplace from:

- local folder: `plugins/codex/marketplace`
- Git source: this repository
  - `Git ref`: usually `main`
  - `Sparse paths`: `plugins/codex/marketplace`

The marketplace currently exposes:

- `Burp`
- `Vanta`

## Codex Paths

- Marketplace source root: `plugins/codex/marketplace/`
- Shared Codex services: `plugins/codex/services.json`
- Burp-only services: `plugins/codex/services.burp.json`
- Vanta-only services: `plugins/codex/services.vanta.json`
- Codex CLI wrapper: `plugins/codex/src/cli.ts`
- Codex setup script: `plugins/codex/scripts/setup.sh`
- Codex uninstall script: `plugins/codex/scripts/uninstall.sh`

## Commands

```bash
./plugins/codex/scripts/setup.sh
./plugins/codex/scripts/uninstall.sh
npm test
```

## Repo Layout

- `plugins/codex/` contains the Codex-facing marketplace, manifests, and setup scripts.
- `packages/` contains shared launcher and workflow code that can be reused by future platform targets.
- `integrations/` contains local integration-specific assets such as the Burp adapter.

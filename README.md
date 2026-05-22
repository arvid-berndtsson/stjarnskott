# Stjarnskott

This repository is a Codex marketplace source for internal security and compliance plugins.

## Use It In Codex

Add the marketplace from:

- local folder: `codex/marketplace`
- Git source: this repository
  - `Git ref`: usually `main`
  - `Sparse paths`: `codex/marketplace`

The marketplace currently exposes:

- `Burp`
- `Vanta`

## Codex Paths

- Marketplace source root: `codex/marketplace/`
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

## Repo Layout

- `codex/` contains the Codex-facing marketplace, manifests, and setup scripts.
- `packages/` contains shared launcher and workflow code that can be reused by future platform targets.
- `integrations/` contains local integration-specific assets such as the Burp adapter.

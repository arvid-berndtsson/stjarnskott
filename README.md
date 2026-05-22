# Stjarnskott

This repository is a Codex marketplace source for internal security and compliance plugins.

## Use It In Codex

Add the marketplace from:

- local folder: `platforms/codex/marketplace`
- Git source: this repository
  - `Git ref`: usually `main`
  - `Sparse paths`: `platforms/codex/marketplace`

The marketplace currently exposes:

- `Burp`
- `Vanta`

## Codex Paths

- Marketplace source root: `platforms/codex/marketplace/`
- Shared Codex services: `platforms/codex/services.json`
- Burp-only services: `platforms/codex/services.burp.json`
- Vanta-only services: `platforms/codex/services.vanta.json`
- Codex CLI wrapper: `platforms/codex/src/cli.ts`
- Codex setup script: `platforms/codex/scripts/setup.sh`
- Codex uninstall script: `platforms/codex/scripts/uninstall.sh`

## Commands

```bash
./platforms/codex/scripts/setup.sh
./platforms/codex/scripts/uninstall.sh
npm test
```

## Repo Layout

- `platforms/codex/` contains the Codex-facing marketplace, manifests, and setup scripts.
- `packages/` contains shared launcher and workflow code that can be reused by future platform targets.
- `integrations/` contains local integration-specific assets such as the Burp adapter.

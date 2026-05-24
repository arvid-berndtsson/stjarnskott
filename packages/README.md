# Packages

This directory contains shared workspace packages used across the Stjarnskott monorepo.

- `launcher/`
  Service startup, manifest loading, Codex export/install, and CLI orchestration.
- `src/`
  Neutral shared source for Burp and ZAP helpers used by the launcher and plugins.

New reusable logic should go here rather than directly into a plugin or a single integration module.

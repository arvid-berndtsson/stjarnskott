# Packages

This directory contains shared workspace packages used across the Stjarnskott monorepo.

- `launcher/`
  Service startup, manifest loading, Codex export/install, and CLI orchestration.
- `security-workflows/`
  Shared Burp-aware workflow logic, passive and active checks, findings generation, and reporting.

New reusable logic should go here rather than directly into a plugin or a single integration module.

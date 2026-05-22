# Stjarnskott Monorepo Restructure V1

## Summary

This spec defines the first intentional monorepo layout for Stjarnskott so the workspace can grow beyond a single Burp-centered stack. The goal is to separate integrations, shared workflow logic, launcher/control-plane code, plugin surfaces, and coordination artifacts before more MCP servers and agents are added.

## Target Layout

- `integrations/` for MCP-specific modules such as Burp
- `packages/launcher/` for service startup, export/install, manifest loading, and CLI orchestration
- `packages/security-workflows/` for reusable workflow, findings, and reporting logic
- `plugins/` for Codex plugin bundles
- `docs/specs/` for design specs
- `docs/tasks/` for tracked task queues
- `generated/` for runtime output only

## Migration Rules

- Preserve root operator commands as compatibility wrappers.
- Keep shared security logic out of the plugin bundle except for thin adapters.
- Update every tracked doc and script that still implies a single integration root.
- Keep generated artifacts and local machine output out of git.

## Success Criteria

- Burp lives under `integrations/burp/`.
- Root commands still work.
- The plugin MCP still exposes the same tools.
- Shared workflow logic is imported from `packages/security-workflows/`.
- Specs and task queues live under `docs/specs/` and `docs/tasks/`.

---
name: stjarnskott-vanta-workbench
description: Use Vanta from Codex to review failing tests, control health, evidence gaps, and compliance status.
---

# Stjarnskott Vanta Workbench

Use this skill when you need to help someone use Vanta from Codex for compliance and remediation workflows.

## Purpose

This plugin is for:

- exporting Vanta-only Codex MCP config from this repo
- choosing the right Vanta regional endpoint
- completing Vanta OAuth in Codex settings
- using Vanta MCP for compliance test, control, and evidence workflows

## Local Files

- Vanta-only manifest: `codex-workbench.vanta.services.json`
- Combined manifest: `codex-workbench.services.json`
- Launcher CLI: `packages/launcher/src/cli.ts` with root compatibility wrapper at `src/cli.ts`
- Generated Codex output: `generated/codex/`

## Commands

Use these commands from the repository root:

```bash
node --experimental-transform-types packages/launcher/src/cli.ts export --manifest codex-workbench.vanta.services.json
node --experimental-transform-types src/cli.ts install
```

## Regional Endpoints

- US: `https://mcp.vanta.com/mcp`
- EU: `https://mcp.eu.vanta.com/mcp`
- AUS: `https://mcp.aus.vanta.com/mcp`

## Setup Notes

- Vanta MCP currently requires a Vanta Admin role.
- This is a remote-only integration, so there is no local proxy or bundled MCP server script for Vanta in this repo.
- After install, complete Vanta authentication from Codex settings if the inline `/mcp` status view is not actionable.

## Suggested First Prompts

- `Use the Vanta MCP server to list all failing tests.`
- `Use the Vanta MCP server to summarize open compliance gaps.`
- `Use the Vanta MCP server to show the highest-priority failing controls.`

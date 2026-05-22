---
name: stjarnskott-burp-workbench
description: Use Burp from Codex to analyze proxy history, map surface area, run checks, and generate findings.
---

# Stjarnskott Burp Workbench

Use this skill when you need to help someone use Burp from Codex for web security discovery and testing workflows.

## Purpose

This plugin is for:

- installing and loading the Burp MCP extension
- exporting Burp-only Codex MCP config from this repo
- troubleshooting Burp listener and proxy failures
- running passive-first security checks
- using bundled Burp workflow MCP tools from Codex

## Local Files

- Burp extension JAR: `integrations/burp/build/libs/burp-mcp-all.jar`
- Burp proxy launcher: `integrations/burp/run-burp-mcp-proxy.sh`
- Burp-only manifest: `codex-workbench.burp.services.json`
- Launcher CLI: `packages/launcher/src/cli.ts` with root compatibility wrapper at `src/cli.ts`
- Generated Codex output: `generated/codex/`

## Commands

Use these commands from the repository root:

```bash
node --experimental-transform-types packages/launcher/src/cli.ts export --manifest codex-workbench.burp.services.json
node --experimental-transform-types src/cli.ts install
```

If Burp should stay running as a managed service for the session:

```bash
node --experimental-transform-types packages/launcher/src/cli.ts start --manifest codex-workbench.burp.services.json
```

## Bundled MCP Tools

- `stjarnskott:burp-health-check`
- `stjarnskott:burp-find-workspace`
- `stjarnskott:burp-prepare-codex`
- `stjarnskott:burp-passive-web-check`
- `stjarnskott:burp-summarize-history`
- `stjarnskott:burp-discover-surface`
- `stjarnskott:burp-run-active-checks`
- `stjarnskott:burp-workflow`
- `stjarnskott:burp-generate-report`

## Troubleshooting

If Burp is open but Codex cannot use it:

- check `generated/codex/status.json`
- check `generated/codex/logs/burp.stderr.log`
- confirm the Burp MCP listener is enabled on `127.0.0.1:9876`
- rerun the Burp-only export

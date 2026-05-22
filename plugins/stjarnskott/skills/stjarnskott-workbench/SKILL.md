---
name: stjarnskott-workbench
description: Use the Stjarnskott workbench to install, launch, troubleshoot, and operate Burp plus Codex security tooling with passive-first guidance.
---

# Stjarnskott Workbench

Use this skill when you need to help someone operate the Stjarnskott security workbench from Codex.

## Purpose

This plugin is for:

- installing and loading the Burp MCP extension
- enabling optional remote MCP services such as Vanta
- exporting Codex MCP config from this repo
- troubleshooting Burp listener and proxy failures
- running passive-first security checks
- deciding when to use shell tools like `curl` versus Burp workflows
- using bundled MCP tools for Burp health and Codex preparation
- running the Stjarnskott findings workflow and reading generated artifacts

## Local Files

Important local paths in this repo:

- Burp extension JAR: `integrations/burp/build/libs/burp-mcp-all.jar`
- Burp proxy launcher: `integrations/burp/run-burp-mcp-proxy.sh`
- Workbench manifest: `codex-workbench.services.json`
- Launcher CLI: `packages/launcher/src/cli.ts` with root compatibility wrapper at `src/cli.ts`
- Generated Codex output: `generated/codex/`

## Default Workflow

1. Confirm Burp is needed for the current task.
2. If Burp is needed, confirm the extension JAR is loaded in Burp and the MCP listener is enabled.
3. For unattended Codex use, confirm Burp was given one-time MCP tab setup:
   - `Always allow HTTP history access` is enabled
   - intended hosts are listed under `Auto-Approved HTTP Targets`
   - if hands-off request replay is desired, HTTP request approval is disabled or the relevant hosts are auto-approved
4. Run the workbench export flow so Codex gets the current MCP block.
5. Start with passive checks.
6. Escalate only when the operator explicitly wants deeper testing and is authorized.

## Commands

Use these commands from the repository root:

```bash
npm run export:codex
node --experimental-transform-types src/cli.ts install
```

If Burp should stay running as a managed service for the session:

```bash
npm run start:mcps
```

For remote-only services like Vanta, enable the service in `codex-workbench.services.json`, export, install, and then complete OAuth in Codex when prompted. No local proxy process is required.

## Bundled MCP Tools

This plugin now includes a bundled MCP server with these tools:

- `stjarnskott:burp-health-check`
- `stjarnskott:burp-find-workspace`
- `stjarnskott:burp-prepare-codex`
- `stjarnskott:burp-passive-web-check`
- `stjarnskott:burp-summarize-history`
- `stjarnskott:burp-discover-surface`
- `stjarnskott:burp-run-active-checks`
- `stjarnskott:burp-workflow`
- `stjarnskott:burp-generate-report`

Use those when you want the plugin to check Burp readiness or prepare Codex automatically instead of only returning instructions.

## Troubleshooting

If Burp is open but Codex cannot use it:

- check `generated/codex/status.json`
- check `generated/codex/logs/burp.stderr.log`
- confirm the Burp MCP listener is enabled on `127.0.0.1:9876`
- confirm `Always allow HTTP history access` is enabled if the task needs Burp history
- confirm intended hosts are listed under `Auto-Approved HTTP Targets` if you want hands-off request automation
- rerun `npm run export:codex`

If Burp is not wanted for the current task:

- disable the `burp` service in `codex-workbench.services.json`
- rerun the export

## Testing Style

Prefer passive, low-noise checks first:

- DNS resolution
- TLS and response headers
- `robots.txt`
- `security.txt`
- simple homepage fingerprinting

Use Burp when:

- browser flows matter
- authenticated testing matters
- proxy history or manual repeater-style workflows matter

Use shell tools like `curl` when:

- you want fast transparent checks
- you need simple reproducible probes
- Burp is not required for the question

# Integrations

This directory contains concrete MCP-specific modules.

- `burp/`
  Burp extension, Burp proxy launcher, Gradle build, and Burp-local integration assets.

Remote-only MCP services can also live at the launcher-manifest layer when they do not require local adapter code. The shared Vanta MCP connection is currently handled that way through `platforms/codex/services.json`.

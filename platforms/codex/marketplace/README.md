# Codex Marketplace Source

This directory is the OpenAI-aligned marketplace source root for the Stjarnskott Codex plugins.

Use it in Codex in one of these ways:

- Local folder source: point Codex at `platforms/codex/marketplace/`
- Git repo source: point Codex at the repository and set `Sparse paths` to `platforms/codex/marketplace`

This source root intentionally contains both:

- `.agents/plugins/marketplace.json`
- `plugins/<plugin-name>/`

That keeps the marketplace manifest and plugin bundles in the same source root, which matches Codex marketplace expectations for repo and local-folder installs.

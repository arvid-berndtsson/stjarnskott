# Burp Proxy Build Integration Design

Date: 2026-05-22
Status: Proposed and approved in conversation
Scope: `integrations/burp/`

## Summary

The current Burp MCP module assumes that `integrations/burp/libs/mcp-proxy-all.jar` already exists before builds, tests, or local proxy launches can succeed. This is fragile because the proxy artifact is treated as manually managed workspace state rather than as a declared build input.

This design makes the proxy JAR a first-class build artifact produced by Gradle. The long-term goal is that a fresh checkout can build, test, and run the Burp MCP module without manual placement of `mcp-proxy-all.jar`.

## Goals

- Remove the manual dependency on `integrations/burp/libs/mcp-proxy-all.jar`.
- Make `./gradlew test` and `./gradlew embedProxyJar` reproducible from a fresh checkout.
- Keep proxy upgrades explicit and versioned.
- Keep Burp runtime discovery separate from proxy artifact production.
- Preserve the existing extension packaging behavior: `burp-mcp-all.jar` should still contain the proxy JAR for downstream use.

## Non-Goals

- Redesign the Burp extension UI or MCP tool surface.
- Tie the build to a specific locally installed Burp version.
- Solve all future Burp launcher-path changes in the same refactor.
- Introduce checked-in binary artifacts as the source of truth.

## Current Problems

The current design has three sources of fragility:

1. `build.gradle.kts` embeds `libs/mcp-proxy-all.jar` if it happens to exist, but does not produce that file itself.
2. `ProxyEndToEndTest.kt` fails before exercising behavior when the proxy JAR is missing.
3. `run-burp-mcp-proxy.sh` depends on a manually placed file under `integrations/burp/libs/`.

This creates an inconsistent developer experience where successful builds depend on undocumented artifact state outside the declared Gradle graph.

## Recommended Approach

Use an included Gradle build or sibling workspace module for the proxy source, and have `integrations/burp` consume the proxy shaded JAR as a declared build artifact.

The preferred model is:

- The proxy source is available to the workspace as source code, not as a copied binary.
- The proxy build produces a single shaded JAR artifact.
- `integrations/burp` resolves that artifact through Gradle task wiring.
- Tests and launch scripts consume a generated path under `build/`, not `libs/`.

This keeps builds reproducible while making proxy upgrades a normal source-controlled change.

## Architecture

### Build Boundaries

- `mcp-proxy` owns building `mcp-proxy-all.jar`.
- `integrations/burp` owns:
  - embedding the proxy JAR into `burp-mcp-all.jar`
  - using the proxy JAR in end-to-end proxy tests
  - launching the proxy for local developer workflows

No tracked file in `integrations/burp/libs/` is treated as required mutable setup state.

### Artifact Flow

1. Gradle builds the proxy shaded JAR from source.
2. `integrations/burp` copies or resolves that JAR into a generated location under `build/`.
3. `embedProxyJar` embeds the generated proxy JAR into `build/libs/burp-mcp-all.jar`.
4. Proxy E2E tests and the launcher read the generated JAR path from Gradle-managed output.

### Versioning

The proxy source revision must be explicit and reviewable.

Acceptable ways to represent this include:

- vendoring the proxy source into this workspace
- using a git submodule or pinned sibling checkout
- using Gradle included build wiring with a pinned repository state

The key requirement is that a checkout used by CI and developers resolves to the same proxy source revision.

## Component Changes

### Gradle

`integrations/burp/build.gradle.kts` should be updated so that:

- the proxy JAR is a declared input, not a hardcoded file in `libs/`
- `embedProxyJar` depends on the task that produces the proxy shaded JAR
- a generated proxy artifact path under `build/` is the canonical local path

The build should fail with a clear message if the included proxy project is missing or misconfigured, but it should not fail because a developer forgot to copy a file by hand.

### Tests

`ProxyEndToEndTest.kt` should stop reading `File("libs/mcp-proxy-all.jar")`.

Instead, the test task should provide the resolved proxy JAR path via a system property or environment variable. The test should:

- read the path from Gradle-provided configuration
- fail clearly if that path is missing
- exercise proxy behavior rather than setup assumptions

This keeps the test aligned with the real build graph and prevents false-negative failures from missing manual artifacts.

### Launcher

`run-burp-mcp-proxy.sh` should stop assuming `integrations/burp/libs/mcp-proxy-all.jar` exists.

Recommended behavior:

- prefer a generated proxy JAR path under `build/`
- optionally invoke a small prep task or fail with a message that points to one reproducible Gradle command
- continue using `BURP_APP_PATH`, `BURP_JAVA_PATH`, and `BURP_MCP_SSE_URL` for runtime overrides

This preserves runtime flexibility while removing hidden packaging assumptions.

## Burp Upgrade Strategy

Burp updates should remain operationally separate from proxy artifact production.

The build should not require Burp to be installed in order to produce the proxy JAR. Burp matters only for:

- loading the extension in the application
- using Burp's bundled Java runtime for local proxy launch if desired

If Burp changes app layout or bundled JRE paths in future versions, the expected impact should be limited to launcher/runtime discovery code and documentation, not the proxy build pipeline.

## Proxy Upgrade Strategy

Proxy upgrades should become explicit, reviewable source changes.

The expected workflow is:

1. Update the pinned proxy source revision or included source contents.
2. Run the standard Gradle build and test tasks from a fresh checkout.
3. Verify the extension still embeds the proxy artifact correctly.
4. Verify proxy end-to-end tests still pass.

This turns upgrades into a normal dependency maintenance process instead of a manual binary replacement step.

## CI Expectations

CI should validate the reproducibility contract:

- `./gradlew test` succeeds on a fresh checkout without manual artifact placement
- `./gradlew embedProxyJar` succeeds from declared inputs only
- proxy end-to-end tests use the Gradle-produced artifact path

If the proxy source is unavailable or miswired, CI should fail early and clearly in the build stage.

## Risks

### Included Build Drift

If the proxy project changes its shaded JAR task name or output conventions, the integration can break. This risk is manageable if the integration contract stays narrow and is exercised in CI.

### Repository Shape Complexity

Adding an included build or vendored module makes the workspace slightly more complex. This is acceptable because it replaces undocumented manual state with explicit build structure.

### Launcher Path Assumptions

Burp runtime path assumptions may still need occasional updates across Burp releases. This remains a contained runtime concern and should not affect artifact production.

## Alternatives Considered

### Download a Pinned Proxy Release Artifact

This would be workable if the proxy source must remain external, but it introduces a release-hosting and network dependency into builds. It is less durable than source-based integration.

### Keep `libs/` and Auto-Fill It

This reduces manual work but keeps the wrong source of truth. A generated artifact should live under `build/`, not under a hand-maintained project directory that looks like static source.

## Open Implementation Decisions

These decisions should be resolved during implementation planning:

- whether the proxy source should be vendored directly or attached as an included sibling build
- the exact Gradle task and output contract exposed by the proxy project
- whether the launcher should auto-build the proxy or require one explicit preparatory Gradle command

## Success Criteria

This design is successful when all of the following are true:

- a fresh checkout can run the test suite without manually placing `mcp-proxy-all.jar`
- the extension build embeds a Gradle-produced proxy artifact
- the proxy E2E test exercises runtime behavior instead of failing on missing setup files
- developers can launch the proxy locally without maintaining `integrations/burp/libs/` by hand


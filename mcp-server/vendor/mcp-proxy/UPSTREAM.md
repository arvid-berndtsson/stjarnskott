# Vendored Upstream

Source repository: https://github.com/PortSwigger/mcp-proxy.git
Import method: git subtree --squash
Imported branch: main
Imported on: 2026-05-22
Resolved commit SHA: a31fe3ada817007d4718ca99102c25033e441295

Upgrade workflow:
1. Run `git subtree pull --prefix=mcp-server/vendor/mcp-proxy https://github.com/PortSwigger/mcp-proxy.git main --squash`
2. Re-run `./gradlew test embedProxyJar` from `mcp-server/`
3. Update this file with the new resolved commit SHA

Notes:
- The vendored upstream currently includes `gradle/wrapper/gradle-wrapper.jar`, which is part of Gradle wrapper bootstrapping rather than the built proxy runtime artifact.

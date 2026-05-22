# Vendored Upstream

Source repository: https://github.com/PortSwigger/mcp-proxy.git
Import method: git subtree --squash
Imported branch: main
Imported on: 2026-05-22
Resolved commit SHA: c53ad087709822d1c435b3d048c2b25b4e4b9ff6

Upgrade workflow:
1. Run `git subtree pull --prefix=integrations/burp/vendor/mcp-proxy https://github.com/PortSwigger/mcp-proxy.git main --squash`
2. Re-run `./gradlew test embedProxyJar` from `integrations/burp/`
3. Update this file with the new resolved commit SHA

Notes:
- The vendored upstream currently includes `gradle/wrapper/gradle-wrapper.jar`, which appears intentionally tracked upstream because it is required to bootstrap Gradle for rebuilding and verifying the vendored project, rather than serving as the built proxy runtime artifact.

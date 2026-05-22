# Stjarnskott Monorepo Restructure V1 Tasks

## Module Boundaries

- [x] Move Burp integration into `integrations/burp/`
- [x] Create `packages/launcher/`
- [x] Create `packages/security-workflows/`
- [ ] Add the next integration using the same module contract

## Shared Logic

- [x] Move launcher/control-plane code into the launcher package
- [x] Move workflow/reporting helpers into the shared security package
- [x] Make the plugin consume shared logic instead of owning it

## Coordination

- [x] Create `docs/specs/`
- [x] Create `docs/tasks/`
- [ ] Start future multi-step work with a spec and task file

## Follow-Up

- [ ] Add package-level READMEs as more modules appear
- [ ] Standardize integration metadata and health contracts across future MCPs
- [ ] Add a second integration to prove the structure

# Project Guidelines

## Documentation

Every new system or major architectural change must be documented in `docs/` using the format defined in `TEMPLATE.md` (Motivation, Options considered, Decision, Implementation).

## Conventions

- Card-specific logic uses **imperative resolver registries** (see `spellResolvers.ts`, `triggerResolvers.ts`) rather than expanding type unions.
- Predicates (`predicates.ts`) are the universal filtering mechanism for caster eligibility, placement, and targeting.
- Keywords are declared on the card data; runtime status tokens (`ward`, `stealth`, `lance`) track consumable state.
- Gameplay behavior must live in the engine pipeline (`decomposePlayerAction` -> `runChecks` -> `applyAtomicAction`) or engine resolver registries. **Never** put card-specific gameplay logic in `store/` or `components/`; UI/store only render and dispatch engine actions/pending interactions.
# Development

Future contributors and Codex sessions must inspect existing implementation
before adding new abstractions. Prefer the project patterns already present.

## Mandatory Pre-Work

Before implementation:

1. Read `README.md`.
2. Read `docs/MASTER_PLAN.md`.
3. Read `docs/PRODUCT_SPEC.md`.
4. Read `docs/PHASES.md`.
5. Read relevant ADRs in `docs/DECISIONS.md`.
6. Read `docs/security.md`.
7. Read `docs/DATA_MODEL.md` if database work is involved.
8. Read `docs/TESTING.md`.
9. Inspect existing source code.
10. Inspect relevant tests.
11. Inspect git status.
12. Identify the current phase.
13. Identify explicit exclusions.

## Evidence Rules

Documentation is not implementation evidence. Do not report a feature, table,
policy, API, security control, or workflow as implemented merely because a
document describes it.

Use these labels strictly:

- PLANNED: Specified but not necessarily present in code.
- IMPLEMENTED: Repository evidence exists.
- VERIFIED: Repository evidence exists and appropriate verification succeeded.

Rules:

- Reuse shared UI primitives before creating new component styles.
- Keep domain logic out of generic UI components.
- Keep feature-specific logic inside the relevant feature folder.
- Validate external input at server boundaries.
- Do not access the database directly from arbitrary UI components.
- Maintain clear server/client boundaries.
- Avoid premature abstraction and unused helper layers.
- Do not introduce fake product functionality to make screens look complete.
- Avoid hidden feature creep.
- Avoid undocumented schema changes.
- Avoid undocumented architecture changes.
- No feature is complete merely because it compiles.
- Update tests when behavior changes.
- Keep secrets out of source control and browser bundles.

## Documentation Updates

After each implementation phase, update only documents materially affected. At
minimum consider whether the following require updates:

- `docs/MASTER_PLAN.md`
- `docs/PHASES.md`
- `docs/DATA_MODEL.md`
- `docs/security.md`
- `docs/DECISIONS.md`
- `docs/TESTING.md`
- `docs/CHANGELOG.md`
- `README.md`

Useful commands:

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
PHASE2_RUNTIME_VERIFICATION=1 PHASE2_SUPABASE_TARGET=development npm run test:security:runtime
npm run test:e2e
npm run build
```

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
- IMPLEMENTED - VERIFICATION PENDING: Implementation exists, but a required
  verification dependency or journey remains incomplete.

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

## Documentation Definition Of Done

Documentation is part of definition of done. Every material feature, fix,
migration, contract, architecture, security, dependency, test-strategy, or
user-visible behavior change must update affected documentation in the same
task. No separate documentation pass should normally be required.

Use the change matrix and checklist in `docs/DOCUMENTATION_GOVERNANCE.md`.
Final reports must list updated documentation or explain why none was required.
Do not update every document for trivial edits; update every materially affected
claim, contract, decision, setup instruction, test expectation, and status.

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

## UX Audit Expectations

Before billing or other expansion phases, preserve the Phase 9.5 baseline:

- Review authenticated flows at 375px, 390px, 430px, 768px, and desktop widths.
- Keep visible product copy in owner/customer language rather than internal
  implementation terminology.
- Keep booking money displayed as natural currency while storing values as
  integer minor units.
- Keep the dashboard operational first; do not replace it with a wall of
  summary metrics.
- Extend the canonical E2E journey when a new phase changes the core workflow.

## Branch Integration

- Fetch and compare both branch tips and their merge base before reconciliation.
- Prefer a normal merge for already-shared branches; do not rewrite remote
  history for convenience.
- Resolve conflicts file by file. Preserve verified domain/security behavior,
  immutable migrations, current tests, and accurate documentation.
- Run the complete local gate before push, then verify actual GitHub Actions and
  pull-request mergeability before merging to `main`.
- Do not force push `main`, bypass checks, or treat CI as a deployment pipeline.

Required checks, secret configuration, and branch protection recommendations
are documented in `docs/CI.md`.

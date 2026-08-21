# Documentation Governance

STATUS: VERIFIED

## Permanent Rule

Documentation is part of definition of done. Every materially approved
implementation change must update the relevant documentation in the same task.
This applies to features, bug and security fixes, migrations, architecture,
APIs/RPCs, data models, workflows, validation, operational behavior, test
strategy, dependencies, and user-visible behavior.

Documentation must describe repository and verified development-database
evidence accurately. It must not claim planned work is implemented. A separate
documentation task should not normally be required for ordinary approved work.

Final task reports must list documentation updated or explicitly explain why no
documentation change was required.

## Status Taxonomy

- PLANNED: Direction is specified; implementation evidence is not required.
- IMPLEMENTED: Repository, migration, configuration, or infrastructure evidence
  exists.
- VERIFIED: Implementation evidence exists and an appropriate verification has
  passed.
- IMPLEMENTED - VERIFICATION PENDING: Implementation exists, but a required
  verification dependency or journey is still incomplete.

## Change Matrix

| Change type | Documentation to review |
| --- | --- |
| Product feature or workflow | `PRODUCT_SPEC`, `MASTER_PLAN`, `PHASES`, feature README, `CHANGELOG`, and `TESTING` when coverage changes |
| Database/schema/RPC | Migration, `DATA_MODEL`, `MIGRATIONS`, architecture/security where boundaries change, generated types, and `CHANGELOG` |
| Security behavior | `security`, `TESTING`, `RELEASE_CHECKLIST`, affected ADR/feature docs, and `CHANGELOG` |
| Architecture decision | New/superseding ADR, `architecture`, and `MASTER_PLAN` when roadmap or non-negotiable architecture changes |
| Analytics definition | `ANALYTICS_DEFINITIONS`, feature README, `DATA_MODEL` when applicable, and `TESTING` |
| Responsive/reusable UI rule | `DESIGN_SYSTEM`, `RESPONSIVE_QA`, regression tests, and `CHANGELOG` when material |
| Bug fix | `CHANGELOG`, regression coverage in `TESTING`, and affected feature docs when documented behavior changes |
| Dependency/configuration | `README`/development setup, architecture/security when boundaries change, lockfile, and `CHANGELOG` when material |
| Trivial formatting or typo | No broad documentation update; fix the affected text only |

Do not update every document for every small edit. Update every document whose
material claims, evidence, decisions, setup, or operational guidance changed.

## Pre-Finish Checklist

- [ ] Implementation complete.
- [ ] Tests updated where behavior or risk changed.
- [ ] Security implications reviewed.
- [ ] Documentation impact reviewed.
- [ ] Relevant documentation updated in this task.
- [ ] `CHANGELOG` updated when the change is material.
- [ ] Phase/status evidence updated where applicable.
- [ ] Migration ledger/process updated when database work changed.
- [ ] No document falsely claims unimplemented or unverified behavior.
- [ ] Final report lists documentation updated or explains why none was needed.

## Documentation Inventory

Audit date: 2026-08-21.

| File | Classification | Purpose/current-state note |
| --- | --- | --- |
| `AGENTS.md` | CURRENT | Mandatory repository and documentation rules. Next.js-generated block is retained. |
| `CLAUDE.md` | GENERATED | Pointer to `AGENTS.md`; do not duplicate governance. |
| `README.md` | CURRENT | Setup, current capability snapshot, boundaries, and document index. |
| `database/README.md` | CURRENT | Database entry point; delegates process to `MIGRATIONS`. |
| `docs/MASTER_PLAN.md` | CURRENT | Roadmap and current verified capability evidence. |
| `docs/PRODUCT_SPEC.md` | CURRENT | Product/domain behavior, including booking/customer and confirmation-contact rules. |
| `docs/PHASES.md` | CURRENT | Historical phase status and verification evidence. |
| `docs/DATA_MODEL.md` | CURRENT | Planned and implemented entities plus migration evidence. |
| `docs/DECISIONS.md` | CURRENT | Append-only accepted ADR history. |
| `docs/DESIGN_SYSTEM.md` | CURRENT | Existing visual/responsive rules; broad redesign remains planned. |
| `docs/TESTING.md` | CURRENT | Local, E2E, responsive, and opt-in live runtime coverage. |
| `docs/CHANGELOG.md` | CURRENT | Append-only material implementation history. |
| `docs/RELEASE_CHECKLIST.md` | CURRENT | Release evidence and remaining production controls. |
| `docs/architecture.md` | CURRENT | Concise implemented architecture snapshot and boundaries. |
| `docs/security.md` | CURRENT | Security principles, invariants, and verification status. |
| `docs/development.md` | CURRENT | Contributor workflow and definition of done. |
| `docs/product-boundaries.md` | CURRENT | Explicit implemented-product exclusions and deferred scope. |
| `docs/ANALYTICS_DEFINITIONS.md` | CURRENT | Authoritative implemented analytics formulas and terminology. |
| `docs/DOCUMENTATION_GOVERNANCE.md` | CURRENT | Permanent documentation rule, matrix, checklist, and inventory. |
| `docs/MIGRATIONS.md` | CURRENT | Migration ledger and immutable forward-fix process. |
| `docs/RESPONSIVE_QA.md` | CURRENT | Responsive matrix, findings, evidence, and remaining scope. |
| `docs/CI.md` | CURRENT | GitHub Actions jobs, secrets, merge policy, and deployment boundary. |
| `features/auth/README.md` | CURRENT | Supabase Auth boundary and Phase 2 email exceptions. |
| `features/businesses/README.md` | CURRENT | Business/membership/onboarding ownership. |
| `features/customers/README.md` | CURRENT | Tenant customer, archive, inline creation, and enrichment rules. |
| `features/bookings/README.md` | CURRENT | Booking/customer creation, lifecycle, and non-goals. |
| `features/confirmation-links/README.md` | CURRENT | Confirmation capability and public/server boundary. |
| `features/feedback/README.md` | CURRENT | Private feedback and issue boundary. |
| `features/analytics/README.md` | CURRENT | Tenant-private analytics scope and definitions. |
| `features/billing/README.md`, `lib/billing/README.md` | CURRENT | Explicitly deferred vendor billing boundary. |
| `features/settings/README.md` | CURRENT | Implemented account/session and business-settings navigation boundary. |
| `lib/email/README.md` | CURRENT | Transactional email/outbox/provider boundary. |
| `lib/security/README.md`, `lib/validation/README.md` | CURRENT | Shared utility ownership guidance. |
| `components/forms/README.md`, `components/shared/README.md`, `hooks/README.md`, `types/README.md` | CURRENT | Narrow code-ownership guidance; intentionally concise. |

## Changelog Policy

Record material features, meaningful bug fixes, security fixes, schema/API/RPC
changes, behavior changes, and important maintainability improvements. Do not
add entries for formatting, trivial typo corrections, generated-file churn, or
non-material internal cleanup. Historical entries remain honest and are not
rewritten to imply later capabilities existed earlier.

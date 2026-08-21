<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:my-customers-governance -->

# My Customers Project Governance

Before modifying application code, read:

1. `README.md`
2. `docs/MASTER_PLAN.md`
3. `docs/PRODUCT_SPEC.md`
4. `docs/PHASES.md`
5. `docs/DECISIONS.md`
6. `docs/security.md`
7. `docs/TESTING.md`
8. `docs/DATA_MODEL.md` when database work is involved

Documentation is not implementation evidence. Respect PLANNED, IMPLEMENTED,
VERIFIED, and IMPLEMENTED - VERIFICATION PENDING labels.

Documentation is part of definition of done. Documentation updates are
mandatory for every materially approved implementation change and must happen
in the same task. Before declaring a task complete, inspect the change and
update all relevant project, architecture, security, data-model, migration,
testing, feature, and changelog documentation. Documentation must describe
implemented evidence accurately and must not claim planned work as complete.

Use `docs/DOCUMENTATION_GOVERNANCE.md` for the change matrix and pre-finish
checklist. Final task reports must list documentation updated or explicitly
state why no documentation change was required.

For branch integration or CI changes, read `docs/CI.md`. Do not bypass required
checks, weaken or skip unrelated tests, expose secrets, force-push shared
history, or apply production database migrations from pull-request CI.

Any user-uploaded image feature must document and enforce accepted MIME types,
maximum input bytes and dimensions, optimized output format/dimensions/bytes,
bucket/path and access model, authorization, replacement cleanup, and deletion
behavior. Do not retain raw or unbounded uploads.

<!-- END:my-customers-governance -->

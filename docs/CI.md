# Continuous Integration

STATUS: VERIFIED

GitHub Actions workflow `.github/workflows/ci.yml` validates pull requests into
`main` and pushes to `main`. It does not deploy the application or apply any
database migration.

## Core Jobs

| Check name          | Commands and purpose                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality             | `npm ci`, lint, typecheck, and changed-file `git diff --check`                                                                                |
| Tests               | `npm ci` and unit, integration, static security, governance, and migration convention tests through `npm run test`                            |
| Build               | `npm ci` and the production Next.js build                                                                                                     |
| Dependency Security | `npm ci` and `npm audit --audit-level=moderate`                                                                                               |
| E2E                 | Chromium installation and the complete Playwright suite against its workflow-owned local server and dedicated non-production Supabase project |

CI uses Node 22 because `package.json` requires Node 22 or newer. Official
`actions/checkout@v7` and `actions/setup-node@v7` actions run with `contents:
read` permission. Superseded runs for the same pull request or branch are
cancelled. These action majors use the supported GitHub-hosted action runtime;
the previous v4 actions emitted a Node 20 deprecation warning in run #22.

The workflow was executed for the current release on pull request #5. Quality,
Tests, Build, Dependency Security, and E2E completed successfully after the
required non-production E2E secrets were installed. Runtime Security remained
intentionally skipped behind its documented protected-environment guard.

The Build job needs no Supabase or service-role values. Public configuration is
optional during compilation, and server-only functionality fails closed when a
required runtime boundary is actually invoked.

## E2E Secrets

The E2E job requires these repository or environment secrets for a dedicated
non-production Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`E2E_SIGNUP_EMAIL` is optional. When absent, only the controlled-inbox signup
case remains skipped as documented; ordinary authenticated product journeys
must run. The workflow validates required names without printing values.

On E2E failure, Playwright emits list output, GitHub annotations, and a JSON
report. A post-failure step parses that report and any textual error contexts,
redacts configured secret values, capability URLs, OAuth values, JWTs, bearer
tokens, and email addresses, and uploads only the sanitized output for seven
days. Raw traces, screenshots, videos, environment files, and browser storage
are deliberately excluded because current journeys traverse one-time
confirmation and feedback capabilities. Artifact preparation and upload run
only after the Playwright step fails and cannot convert a test failure into a
successful job.

Run #22 exposed a mobile-only race in the forged business-switch regression:
the test changed a hidden business ID and clicked in separate browser tasks, so
React hydration could restore the authorized ID before submission. The test now
changes the value and calls `requestSubmit` in one browser task. The original
form was correctly submitted when the value survived, and the server action's
membership validation and unavailable redirect remain unchanged.

## Runtime Security

The `Runtime Security` job is defined independently from E2E but guarded by the
repository variable:

- `RUNTIME_SECURITY_ENABLED=true`

When enabled, the job starts with the other jobs and uses the protected GitHub Environment
`supabase-runtime-security`, the three Supabase secrets listed above,
`PHASE2_RUNTIME_VERIFICATION=1`, and `PHASE2_SUPABASE_TARGET=test`. The target
must be a dedicated safe test/development project, never production. Until the
environment and secrets are configured, this job is intentionally skipped and
must not be represented as a CI runtime-security pass.

## Merge Policy

Recommended `main` branch protection:

- require a pull request before merge;
- require Quality, Tests, Build, E2E, and Dependency Security;
- require the branch to be current with `main` when practical;
- require conversation resolution;
- block force pushes and deletion;
- add Runtime Security as required only after its protected environment is
  configured and proven stable.

Merge conflict resolution must preserve current verified product and security
behavior, review files individually, retain immutable migrations, and pass the
full local and GitHub gates. Normal PR merge or a repository-established merge
method is preferred; shared history must not be rewritten.

## Deployment Boundary

Normal PR and `main` GitHub Actions workflows do not call Vercel, apply database
migrations, or mutate Supabase. A separate Vercel Git integration watches the
same repository and deploys merged `main` commits to Production. This separation
does not weaken the merge policy: required CI must pass and the pull request must
be conflict-free before merge. Preview receives no current runtime secrets, and
Vercel builds never apply migrations. The operational process and rollback
boundary are documented in `docs/DEPLOYMENT.md`.

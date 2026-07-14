# Growth OS LaunchHub Data Contract V1 — Test Report

Date: 2026-07-15 (Asia/Hong_Kong / Asia/Tokyo)

## Environment

- Git branch: `feature/growthos-launchhub-data-contract-v1`
- Pull request: #6
- Vercel preview build: passed
- Supabase test branch: `launchhub-data-contract-v1-test`
- Test branch was deleted after validation to stop hourly billing.
- No production migration or production row mutation was performed.

## Branch note

The Supabase development branch initially reported `MIGRATIONS_FAILED` because the parent project does not currently have a complete tracked migration history that can rebuild the production schema from scratch. A minimal test harness matching the required Growth OS tables was therefore created only inside the disposable branch before applying the reviewed LaunchHub migrations.

This is a release-process issue to resolve before relying on automatic Supabase branching for future releases. It did not affect production.

## Applied in the disposable branch

1. LaunchHub data contract v1
2. Token / redirect / duplicate-window hardening
3. Security review controls
4. Source snapshot immutability
5. LaunchHub foreign-key support indexes
6. Synthetic Internal Demo and separate isolation-test tenant

## Passed tests

- Valid SHA-256 token hash resolves exactly one active form.
- Unknown token hash resolves no form.
- Active token hashes are unique.
- Form config must match `client_id` and `brand_id`.
- Service, package and location relationships cannot cross tenant boundaries.
- Configured forms require a valid token hash and at least one allowed origin.
- `anon` and `authenticated` roles have no direct LaunchHub table read access.
- `service_role` can execute the server-only lead creation RPC.
- Valid lead creation atomically creates one lead and one source snapshot.
- Every created snapshot is linked to its lead.
- Canonical service, location, price, payment status and test-data state are derived from database configuration rather than trusted from browser input.
- Tampered price input is rejected.
- Cross-tenant RPC input is rejected.
- Duplicate-window lookup finds a recent same-form / same-phone lead.
- Source tracking fields cannot be modified after insertion.
- A linked snapshot cannot be re-linked to a different lead.
- Supabase security advisor reported no LaunchHub-specific warning-level issue; only expected informational notices for RLS-enabled server-owned tables without browser policies.
- LaunchHub-specific unindexed foreign-key findings were cleared by the support-index migration.

## Remaining release gates

- Implement Growth OS-native admin CRUD and secure one-time token generation / rotation.
- Restore a complete reproducible migration history for the Growth OS parent project.
- Run an HTTP E2E test with a Vercel preview explicitly connected to a disposable Supabase branch.
- Review the final production migration plan and synthetic Internal Demo seed separately before applying anything to production.

## Result

The database contract, tenant isolation, canonical write path and source-snapshot immutability passed the disposable-branch validation. PR #6 remains draft and production remains unchanged.

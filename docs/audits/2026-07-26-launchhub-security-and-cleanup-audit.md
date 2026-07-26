# LaunchHub Security and Cleanup Audit

- Date: 2026-07-26
- Product: Kairvo LaunchHub
- Status: remediation in progress

## Confirmed healthy foundations

- Production build and TypeScript validation pass.
- No Vercel runtime errors were found in the available seven-day window.
- Internal routes currently require the signed LaunchHub admin session and recover through Kairvo SSO.
- Public lead creation validates legal consent, form token, origin, service, package, location, appointment data and recent duplicates.
- Lead and source snapshot creation use the canonical atomic database function.
- Production E2E attribution fixture returns 404 unless explicitly enabled.

## Findings

1. Route protection is prefix-based and therefore fail-open for a newly added internal page that is not added to the list.
2. Public lead rate limiting uses an in-memory Map, which is not durable across serverless instances.
3. Rejected public-lead logs include normalized phone data.
4. `/settings/team` is an obsolete placeholder that advertises a fake temporary Owner access model, even though Kairvo Platform Control now owns real user and App access.
5. `/debug/session` exposes internal configuration health information to authenticated operators and is unnecessary in production.
6. Source paths and CSS still contain Alyssa pilot naming that should not define the product architecture.

## Remediation

- Use explicit public and webhook allowlists; all other application routes fail closed as internal.
- Add database-backed rate limiting with hashed identifiers and bounded cleanup.
- Log only a short non-reversible phone fingerprint.
- Replace Team Access placeholder with a Kairvo Platform Control handoff.
- Remove the debug session page from the production route surface.
- Introduce neutral layout component paths and compatibility shims so future code no longer imports from `components/alyssa`.

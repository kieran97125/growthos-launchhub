# LaunchHub Security and Cleanup Audit

- Date: 2026-07-26
- Product: Kairvo LaunchHub
- Status: hardening verified and ready for production merge

## Confirmed healthy foundations

- Production and Preview builds pass Next.js production compilation and TypeScript validation.
- No Vercel runtime errors were found in the available seven-day window before remediation.
- Internal routes require the signed LaunchHub admin session and recover through Kairvo SSO.
- Public lead creation validates legal consent, form token, origin, service, package, location, appointment data and recent duplicates.
- Lead and source snapshot creation use the canonical atomic database function.
- Production E2E attribution fixture returns a real 404 unless explicitly enabled.

## Remediated findings

1. **Prefix-based fail-open route protection**
   - Replaced with explicit public, legal, embed, public-API and webhook allowlists.
   - Every unclassified UI/API route now fails closed as internal.
   - Unauthenticated internal APIs return JSON 401 rather than an HTML redirect.

2. **Non-durable in-memory public throttling**
   - Added database-backed atomic rate limiting using service-role-only RPC access.
   - Verified transactionally: attempts 1 and 2 are allowed and attempt 3 is blocked under a limit of 2.

3. **Customer phone data in rejection logs**
   - Logs now use only a short non-reversible HMAC fingerprint.
   - The rate-limit table stores no raw IP, phone number or form token.

4. **Weak direct string comparison for signed admin sessions**
   - Replaced with WebCrypto HMAC verification and future-issued timestamp rejection.

5. **Obsolete fake Team Access model**
   - Removed the temporary Owner model and redirected team/App access management to Kairvo Platform Control.

6. **Unnecessary debug route**
   - Deleted `/debug/session` from the production route surface.

7. **Alyssa pilot naming in active component imports**
   - Added neutral `components/layout/AppNav` and `SettingsNav` paths.
   - Existing Alyssa paths remain temporary compatibility shims only, preventing a high-risk all-at-once rename.

## Database verification

- Migration `launchhub_public_rate_limit_v1` applied to the Kairvo product Supabase project.
- `launchhub_public_rate_limits` has RLS enabled and no `anon` or `authenticated` direct table grants.
- `launchhub_check_public_rate_limit` is executable only by `postgres` and `service_role`.
- No customer data or credentials were introduced.

## Preview verification

- Latest Vercel Preview reached `READY`.
- Public `/login` remains reachable.
- Internal routes remain protected by deployment/session gates.
- E2E fixture stays a real 404 when fixtures are disabled.

## Remaining cleanup

- A wider source-tree rename is still needed for remaining pilot-named CSS/classes. It should be executed incrementally with visual regression checks rather than blindly renaming every selector.
- The shared-password admin session is retained as a fallback. Kairvo SSO remains the primary product entry path; future work should eliminate the fallback once operational recovery requirements are fully replaced.

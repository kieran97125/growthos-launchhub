# 2026-07-17 — Protected navigation and native Landing Pages

## Production symptoms

- Selecting Landing Pages could briefly return to the Growth OS SSO handoff.
- The Landing Page list logged `PGRST205` because `public.landing_pages` did not exist in the Growth OS project.

## Root causes

- Next.js prefetch requested protected LaunchHub routes before the session bridge completed and cached the unauthenticated redirect.
- SSO and authentication redirects were not explicitly private and non-cacheable.
- The repository still targeted the previous Alyssa landing-page schema and returned Alyssa local fallback pages.

## Changes

- Disable prefetch on all protected application and settings links.
- Add private/no-store headers and `Vary: Cookie` to authentication redirects.
- Add client-scoped and brand-scoped Growth OS landing page tables with service-role-only data access.
- Read and create only Growth OS-native landing pages; an empty database now renders a genuine empty list.
- Validate publish references against Growth OS brand, lead form, service, package and location tables.

No Alyssa customer data, credentials, domains, pricing, branches or brand identity is migrated.

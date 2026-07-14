# Growth OS LaunchHub Data Boundary

## Product identity

Growth OS LaunchHub is a standalone Growth OS product. Alyssa and Ineffable systems are client/reference implementations only.

## Confirmed infrastructure boundary

- Growth OS Platform database: Supabase project `leadhub-source-os` (`mlubmmandwzvepqolngg`).
- Alyssa operational database: separate Supabase project.
- A known Ineffable operational form token returns `404 invalid_form` from Growth OS LaunchHub production.
- No Alyssa production rows are to be copied into Growth OS.

## Current cleanup item

Growth OS LaunchHub still contains legacy Alyssa-named demo seed code inherited from the source implementation. This is code/demo contamination, not shared production data.

Production must not expose that seed. Local demo data must be explicitly enabled and must later be replaced with Growth OS synthetic Internal Demo data.

## Required runtime guard

The server must validate that `NEXT_PUBLIC_SUPABASE_URL` resolves to the approved Growth OS Supabase project ref before creating a service-role client.

Expected project ref:

`mlubmmandwzvepqolngg`

Optional deployment override:

`GROWTHOS_EXPECTED_SUPABASE_PROJECT_REF`

A mismatch must fail closed and return no customer data.

## Data ownership rules

Every Growth OS LaunchHub tenant record must be scoped by:

- `client_id`
- `brand_id`
- form identity/token
- server-side membership or public-token validation

The browser must never be trusted to choose tenant ownership.

## Release checks

Before every production release:

1. Confirm the configured Supabase project ref matches Growth OS.
2. Confirm known Alyssa / Ineffable tokens return `invalid_form`.
3. Confirm local demo seed is disabled in production.
4. Confirm only synthetic Internal Demo data is visible.
5. Confirm no Alyssa production audit or repair script exists in this repository.
6. Confirm public lead writes remain tenant-scoped and source snapshots remain immutable.

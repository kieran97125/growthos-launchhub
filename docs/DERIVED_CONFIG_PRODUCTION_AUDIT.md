# LaunchHub Derived Config Production Audit

Audit date: 2026-07-14

## Scope

Read-only audit of the connected LaunchHub / Alyssa Supabase form configuration.
No database rows were changed by this audit.

## Product rule

The current source of truth is:

- brand `default_thank_you_url`
- treatment `slug`
- package `promo_price` with `original_price` fallback
- package `currency`
- form default treatment / package selection

The following are generated outputs and must not become stale source-of-truth fields:

- success redirect query parameters
- Pixel event value
- Pixel currency
- Wix embed data attributes

Historical lead source snapshots and submitted events remain immutable evidence.

## Findings

Four stored `success_redirect_url` rows were inconsistent with current treatment or package configuration.

| Form token | Brand | Stored mismatch | Current source of truth |
| --- | --- | --- | --- |
| `alyssa-facelift-wix-form-b69fba` | Alyssa | `value=1680` | package value `988` |
| `alyssa-facelift-wix-form-290844` | Alyssa | `treatment=1234` | treatment slug `slimcut` |
| `ineffable-beauty-388-3-form-4f4a18` | Ineffable Beauty | `treatment=gentle-pore-care` | treatment slug `needle-extraction` |
| `ineffable-beauty-588-form-18d212` | Ineffable Beauty | `treatment=shape-s` | treatment slug `s-lite` |

This confirms the original bug: valid host/path checks alone cannot prove that generated query parameters are current.

## Code response in this branch

The branch `fix/derived-config-consistency` now:

1. derives redirect query parameters from current brand / treatment / package config;
2. derives Pixel value and currency from the selected package;
3. regenerates stored redirect values when a form is saved;
4. returns runtime-derived config from the public form API;
5. shows stale state and reasons in Form Detail;
6. keeps historical lead snapshots untouched;
7. removes `beautytrialhk.com` as a generic Growth OS default domain.

## Existing row handling

Existing stale rows are not changed automatically by deployment.

Safe options after code deployment:

- open and save the affected form in Form Detail; or
- review and deliberately run `docs/DERIVED_CONFIG_BACKFILL_REVIEW.sql`.

The review script defaults to `rollback` and must not be applied without checking the affected rows first.

## Validation status

- Vercel preview build: passed
- Latest preview deployment: READY
- Database audit: completed read-only
- Schema migration: not required
- Production data mutation: not performed

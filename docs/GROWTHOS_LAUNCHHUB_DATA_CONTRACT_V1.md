# Growth OS LaunchHub Data Contract v1

## Status

Implementation branch only. The migration has not been applied to production.

## Shared Growth OS identities

LaunchHub reuses these existing Growth OS tables as the cross-product source of truth:

- `clients`
- `brands`
- `lead_forms`
- `leads`
- `lead_source_snapshots`

Stable ownership fields:

- `client_id`
- `brand_id`
- `lead_form_id`
- `lead_id`
- `source_snapshot_id`

## LaunchHub-owned configuration

The reviewed migration adds:

- `launchhub_services`
- `launchhub_packages`
- `launchhub_locations`
- `launchhub_form_configs`

These tables contain only Campaign / public lead capture configuration. They do not own CRM conversations, contacts, booking operations or outcome history.

## Public token rule

`lead_forms.public_form_token_hash` is the public-token authority.

- Raw tokens are never stored in the database.
- Incoming tokens are SHA-256 hashed server-side.
- Admin UI cannot recover an old raw token from its hash.
- A future token rotation action must generate a new raw token, store only its hash, and display the raw token once.

## Public form read

`GET /api/public/forms/[token]`:

1. checks the Growth OS Supabase project boundary;
2. hashes the incoming token;
3. resolves an active `lead_forms` record;
4. validates `client_id` and `brand_id`;
5. loads tenant-scoped services, packages, locations and form config;
6. validates default service / package / location relationships;
7. derives redirect and event values at runtime.

Unknown client/reference tokens return `invalid_form`.
Missing contract tables fail closed without loading client-specific fallback data.

## Public lead write

`POST /api/public/leads`:

1. validates input, consent, origin and rate limits;
2. resolves the same tenant-scoped public form contract;
3. validates selected service, package and location server-side;
4. checks a short duplicate window;
5. calls the service-role-only `launchhub_create_lead` database function;
6. atomically creates a `lead_source_snapshots` row and a linked `leads` row.

LaunchHub does not write:

- CRM contacts
- CRM bookings
- conversation messages
- CRM lead status history
- sales outcomes

Those remain CRM responsibilities.

## Source snapshot rule

The original attribution payload is preserved in `raw_tracking_data`.
The snapshot is not overwritten by later CRM or manual outcome changes.
The only post-insert link created by the transaction is `lead_id`.

## Deployment sequence

1. Review the migration SQL, FKs, trigger scope checks, RLS and RPC permissions.
2. Apply the migration to a reviewed non-production environment.
3. Add a synthetic Internal Demo service, package, location, form config and hashed token.
4. Validate public form GET.
5. Validate lead submission and linked source snapshot.
6. Validate that a second client / brand cannot access the first tenant's records.
7. Validate known Alyssa and Ineffable tokens remain unavailable.
8. Review admin token rotation before enabling public production collection.
9. Apply production migration only after explicit approval.

## Current limitations

- Existing raw public tokens cannot be recovered from hashes.
- Admin create / duplicate / rotate-token workflows still require a Growth OS-native implementation.
- Production remains fail-closed until the schema and a synthetic test form are deliberately enabled.

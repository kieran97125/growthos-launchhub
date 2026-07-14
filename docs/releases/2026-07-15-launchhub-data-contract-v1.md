# Release: Growth OS LaunchHub Data Contract V1

Release date: 2026-07-15 (Hong Kong time)

## Release commits

- Main release: `765189904c4b0a9f02b0cfe7ee18b2fd73cfd30a`
- Public-form identity hotfix: `acc68b481a312dac2e2931d278240571236e54d6`
- Embed switch hotfix: `ed5f25b56e7db7ae590bf68bed350c841ed5627d`
- Pull request: #6

## Production deployment

- Vercel project: `growthos-launchhub`
- Production release deployment: `dpl_A6FqDayFtv99sqPwAXj1xAfjiZcM`
- Public-form hotfix deployment: `dpl_FuNwwmGF9R5hW16jwNH7CUSSuGPF`
- Final state: `READY`
- Production domain: `https://growthos-launchhub.vercel.app`

## Production database changes

Applied additively to the dedicated Growth OS Supabase project `mlubmmandwzvepqolngg`:

1. LaunchHub service, package, location, and form-config tables
2. tenant-scope validation triggers
3. unique active public-token hashes and redirect validation
4. configured-form security validation
5. canonical atomic lead + source-snapshot writer
6. source-snapshot immutability
7. LaunchHub foreign-key support indexes
8. native Form create/update RPCs
9. native Token rotation/duplicate RPCs

No Alyssa or Ineffable database was read, written, migrated, or linked during this release.

## Synthetic Internal Demo data

Created only in the Growth OS database:

- one Internal Demo service
- one Internal Demo package
- one Internal Demo location
- one active Test Form with `is_test_form=true`

The raw public token is intentionally omitted from this record. The database contains only its SHA-256 hash.

## Validation results

### Database

- native Form update RPC: passed in rollback transaction
- Token rotation RPC: passed in rollback transaction
- Form duplicate RPC: passed in rollback transaction
- tenant and service/package/location scope validation: passed
- tampered price rejection: passed in disposable-branch validation
- source snapshot immutability: passed
- browser roles have no direct LaunchHub table access
- post-release counts:
  - LaunchHub services: 1
  - LaunchHub packages: 1
  - LaunchHub locations: 1
  - LaunchHub form configs: 1
  - existing leads: 17
  - existing source snapshots: 17
  - unlinked snapshots: 0

### HTTP / application

- public Form API with Growth OS synthetic token: `200`
- API mode: `growthos_data_contract_v1`
- returned identity: Internal Demo / AB only
- derived redirect and HKD 388 event value: correct
- known Alyssa demo token: `404 invalid_form`
- unauthenticated `/forms`: served the LaunchHub Admin login gate
- public embed: `200`
- initial embed HTML contains no Alyssa or Ineffable client identity
- Vercel Production and hotfix deployments: `READY`

## Hotfix discovered during smoke testing

The first merged build still rendered the legacy client-specific seed in the public embed component before the Growth OS API response loaded. This did not expose an Alyssa database record, but it violated the product identity boundary. The embed was immediately replaced by a Growth OS-native component that has no client-specific initial seed and loads only validated API configuration.

## Security advisor result

No new LaunchHub-specific warning-level security finding was introduced. LaunchHub tables are deliberately server-owned with RLS enabled and no browser policies. Existing project-wide security and performance advisories outside this release remain tracked separately.

## Rollback boundary

- application rollback: redeploy commit `3b1fe29c4aa2fd7e664586e28f111e61eca81b9e`
- synthetic Test Form may be set inactive without deleting audit evidence
- additive LaunchHub tables/functions must not be dropped after real forms or leads depend on them

## Known follow-up debt

The Growth OS Supabase project does not yet have a complete baseline migration history capable of reconstructing the full core schema automatically on a fresh branch. A separate platform issue is required to restore a reproducible baseline and to address pre-existing Supabase advisor warnings.

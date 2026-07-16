# 2026-07-17 — Landing Page empty state

## Observed failure

The protected route returned HTTP 200 and the database query completed, but the list appeared completely blank.

## Root cause

After the legacy Alyssa fallback was removed, a valid zero-row Growth OS result was passed directly into `pages.map()`. The page had no empty-state renderer and the repository did not distinguish a database error from a successful empty result.

## Product decision

- A successful empty result must explicitly say the list loaded and contains no Landing Pages.
- A database or environment failure must show a distinct retryable error state.
- The empty state must provide the first-Campaign and Brand Library actions.
- No Alyssa customer or demo Landing Page data is copied into Growth OS.

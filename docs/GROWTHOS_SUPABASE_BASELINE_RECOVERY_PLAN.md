# Growth OS Supabase Baseline Recovery Plan

## Problem

The live Growth OS Supabase project contains a valid production schema, but its tracked migration history begins after part of the core schema was created. A fresh Supabase development branch therefore cannot automatically reconstruct the entire project without a temporary baseline harness.

## Required outcome

Produce a reviewed, reproducible baseline that can create the complete Growth OS core schema on an empty project before applying later incremental migrations.

## Scope

- inventory all public tables, enums, functions, triggers, indexes, foreign keys, RLS policies, grants, extensions, and Auth-related hooks
- export schema only; never copy production personal data into migration files
- normalize migration ordering and dependency boundaries
- compare a fresh database generated from migrations against Production metadata
- create a CI or documented validation command for migration drift
- test Supabase branch creation again after the baseline is restored
- preserve dedicated product boundaries for GrowthRadar, LaunchHub, CRM, and CreativeLab

## Separate advisor backlog

The current Supabase advisor reports project-wide issues that pre-date the LaunchHub Data Contract V1 release, including executable SECURITY DEFINER functions, mutable search paths, Auth leaked-password protection, and RLS performance warnings. They must be handled through reviewed, individually scoped migrations rather than folded into a LaunchHub release.

## Safety rules

- no production row export
- no destructive table recreation in Production
- no automatic dropping of existing policies or indexes
- every remediation requires before/after advisor evidence
- migration baseline must be validated on a disposable environment before use

# Phase 9: Phase 6 Documentation Retrofix - Research

**Researched:** 2026-03-18
**Domain:** GSD workflow documentation / retroactive verification artifacts
**Confidence:** HIGH

## Summary

Phase 9 is a pure documentation phase. Phase 6 (RSVP Architecture Refactor & Tech Debt Cleanup) was executed outside the GSD workflow, meaning it has no planning directory, no VERIFICATION.md, and no SUMMARY.md. The v1.0 milestone audit identified 5 "orphaned" RSVP requirements (RSVP-01 through RSVP-05) that were referenced in ROADMAP.md but originally missing from REQUIREMENTS.md.

Since the audit, REQUIREMENTS.md has already been updated to include RSVP-01 through RSVP-05 with checkboxes and traceability entries (currently marked as Phase 9 / Pending). The remaining work is: (1) update those checkboxes to checked and reassign traceability to Phase 6, (2) create the Phase 6 planning directory with a retroactive VERIFICATION.md confirming the code already satisfies all 5 requirements, and (3) optionally create a minimal SUMMARY.md for Phase 6 completeness.

**Primary recommendation:** Follow the exact VERIFICATION.md format used by Phases 5 and 7, but note this is a retroactive verification of already-shipped code. Reference specific files, lines, and database objects as evidence.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSVP-01 | Unmatched guest saved with `match_status = 'unmatched'` in `arrival_permits` | Verify DB trigger logic and `arrival_permits` schema have `match_status` column |
| RSVP-02 | Matched guest saved with `match_status = 'matched'` and linked `invitation_id` updated | Verify trigger sets `match_status = 'matched'` and populates `invitation_id` FK |
| RSVP-03 | Legacy trigger `sync_rsvp_to_invitations` removed | Confirm trigger no longer exists in database |
| RSVP-04 | Google Sheets webhook trigger (`sheets_sync_trigger`) removed | Confirm trigger and edge function dependency removed |
| RSVP-05 | Admin dashboard surfaces unmatched RSVPs for manual linking or new invitation creation | Verify Dashboard.tsx has unmatched RSVP UI (banner, filter, or resolution flow) |
</phase_requirements>

## Current State Analysis

### What Already Exists

| Artifact | Location | Status |
|----------|----------|--------|
| RSVP requirements in REQUIREMENTS.md | Lines 79-84 | Present but unchecked, traceability says "Phase 9 / Pending" |
| RSVP traceability entries | Lines 168-172 | Present, pointing to Phase 9 |
| Phase 6 in ROADMAP.md | Phase 6 section | Complete with task list (6.1-6.5 all checked) |
| Phase 6 planning directory | `.planning/phases/06-rsvp-architecture-refactor-tech-debt-cleanup/` | DOES NOT EXIST |
| Phase 6 VERIFICATION.md | N/A | DOES NOT EXIST |
| Phase 6 SUMMARY.md | N/A | DOES NOT EXIST |
| Phase 6 code implementation | Various DB migrations + Dashboard.tsx | FULLY IMPLEMENTED (confirmed by audit) |

### What Needs to Be Created/Modified

| Action | Target | Details |
|--------|--------|---------|
| Update checkboxes | REQUIREMENTS.md lines 80-84 | Change `[ ]` to `[x]` for RSVP-01 through RSVP-05 |
| Update traceability | REQUIREMENTS.md lines 168-172 | Change Phase from "Phase 9" to "Phase 6" and Status from "Pending" to "Complete" |
| Create directory | `.planning/phases/06-rsvp-architecture-refactor-tech-debt-cleanup/` | New directory for Phase 6 artifacts |
| Create VERIFICATION.md | `06-VERIFICATION.md` in Phase 6 directory | Retroactive verification confirming all 5 requirements are satisfied |

## Architecture Patterns

### VERIFICATION.md Format (from existing phases)

The project has an established VERIFICATION.md format used by Phases 1-5, 7, and 8. Key sections:

```
---
phase: {phase-slug}
verified: {ISO timestamp}
status: passed
score: {N/N} must-haves verified
re_verification: {true/false}
---

# Phase N: {Name} Verification Report

## Goal Achievement
### Observable Truths (table: #, Truth, Status, Evidence)

## Required Artifacts (table: Artifact, Expected, Status, Details)

## Key Link Verification (table: From, To, Via, Status, Details)

## Requirements Coverage (table: Requirement, Source Plan, Description, Status, Evidence)

## Anti-Patterns Found

## Summary
```

### Retroactive Verification Special Considerations

Since Phase 6 was executed outside GSD workflow:
- **No source plan exists** -- the "Source Plan" column in Requirements Coverage should reference "ROADMAP.md tasks 6.1-6.5" instead of a plan file
- **re_verification should be false** -- this is the first formal verification, even though the code shipped earlier
- **Evidence must reference actual code/DB objects** -- the audit confirmed implementation; the VERIFICATION.md should cite specific files, migration files, or database objects

### REQUIREMENTS.md Update Pattern

The requirements are already registered. The fix is minimal:
1. Change 5 checkboxes from `[ ]` to `[x]`
2. Change 5 traceability rows from `Phase 9 | Pending` to `Phase 6 | Complete`
3. Update coverage count if needed (currently shows 47 total, 47 mapped -- this is correct)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verification format | Custom format | Copy structure from `07-VERIFICATION.md` or `05-VERIFICATION.md` | Consistency with existing phases |
| Evidence gathering | Manual guessing | Reference the v1.0 audit report findings | Audit already confirmed all 5 requirements are functional |

## Common Pitfalls

### Pitfall 1: Marking requirements as Phase 9 instead of Phase 6
**What goes wrong:** The traceability table currently says "Phase 9" for RSVP requirements, but Phase 9 is the documentation retrofix -- the actual implementation was Phase 6.
**How to avoid:** Update traceability to show Phase 6 as the implementing phase. Phase 9 is only the documentation cleanup.

### Pitfall 2: Creating a VERIFICATION.md that references non-existent plan files
**What goes wrong:** The standard VERIFICATION.md format references "Source Plan" for each requirement. Phase 6 has no plan files.
**How to avoid:** Use "ROADMAP.md Phase 6 tasks" as the source reference, matching the audit report's `claimed_by_plans` field.

### Pitfall 3: Attempting to verify code that may have changed since Phase 6
**What goes wrong:** Phase 6 was completed on 2026-03-17. Subsequent phases may have modified the same files.
**How to avoid:** The verification should confirm current state satisfies the requirements, not try to reconstruct the original Phase 6 diff. The audit (2026-03-18) already confirmed current state is functional.

### Pitfall 4: Forgetting to create the Phase 6 directory
**What goes wrong:** The Phase 6 planning directory does not exist at all. Without creating it, there is nowhere to put VERIFICATION.md.
**How to avoid:** Create `.planning/phases/06-rsvp-architecture-refactor-tech-debt-cleanup/` as the first step.

## Evidence Sources for VERIFICATION.md

The planner should instruct the executor to verify each requirement against actual code/DB state. Based on the audit and CLAUDE.md:

| Requirement | Evidence Location |
|-------------|-------------------|
| RSVP-01 | `arrival_permits` table has `match_status` column; DB trigger sets 'unmatched' when no phone match in `invitations` |
| RSVP-02 | DB trigger sets `match_status = 'matched'` and populates `invitation_id` when phone matches; also updates `confirmed_pax` on the invitation |
| RSVP-03 | Legacy trigger `sync_rsvp_to_invitations` and its function no longer exist in the database |
| RSVP-04 | `sheets_sync_trigger` webhook trigger no longer exists; `sync-to-sheets` edge function is decoupled or removed |
| RSVP-05 | `Dashboard.tsx` contains unmatched RSVP UI -- likely an `UnmatchedBanner` or filter mechanism (audit references "UnmatchedBanner + resolution UI wired") |

## Scope Boundaries

### In Scope
- Update REQUIREMENTS.md checkboxes and traceability for RSVP-01 through RSVP-05
- Create Phase 6 planning directory
- Create retroactive VERIFICATION.md for Phase 6
- Optionally create a minimal SUMMARY.md for Phase 6

### Out of Scope
- Any code changes (Phase 6 code is already complete)
- Integration fixes (those belong to Phase 10)
- Re-running tests (Phase 8 E2E tests already cover RSVP flow)
- Modifying ROADMAP.md (Phase 6 is already marked complete there)

## Open Questions

1. **Should a retroactive PLAN.md be created for Phase 6?**
   - What we know: Other phases have PLAN files, but Phase 6 was executed ad-hoc
   - Recommendation: Skip it. The ROADMAP.md task list (6.1-6.5) serves as the de facto plan. Creating a fake retroactive plan adds no value.

2. **Should a SUMMARY.md be created for Phase 6?**
   - What we know: Other completed phases have SUMMARY files
   - Recommendation: Optional but low value. The VERIFICATION.md is the critical missing artifact. A brief SUMMARY noting "executed outside GSD workflow" would be nice-to-have.

## Sources

### Primary (HIGH confidence)
- `.planning/REQUIREMENTS.md` -- current state of requirement registration (lines 80-84, 168-172)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- audit confirming all 5 RSVP requirements are functionally implemented
- `.planning/ROADMAP.md` -- Phase 6 task list showing all 5 tasks checked complete
- `.planning/phases/07-testing-qa-infrastructure/07-VERIFICATION.md` -- format reference
- `.planning/phases/05-paywalls-upgrade-modal/05-VERIFICATION.md` -- format reference

### Filesystem verification (HIGH confidence)
- Phase 6 directory confirmed non-existent via `ls` command
- Phase 9 directory exists with only `.gitkeep`

## Metadata

**Confidence breakdown:**
- Requirements update: HIGH -- exact lines identified, changes are trivial checkbox/text edits
- VERIFICATION.md format: HIGH -- two complete examples available as templates
- Evidence for requirements: HIGH -- audit report already confirmed all 5 are satisfied
- Scope: HIGH -- this is documentation-only, no ambiguity

**Research date:** 2026-03-18
**Valid until:** Indefinite (documentation patterns are stable)

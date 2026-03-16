---
phase: 05-paywalls-upgrade-modal
plan: "02"
subsystem: dashboard-paywall
tags: [paywall, dashboard, feature-gating, upgrade-modal]
dependency_graph:
  requires: [05-01]
  provides: [paywall-enforcement-dashboard]
  affects: [src/pages/Dashboard.tsx]
tech_stack:
  added: []
  patterns: [conditional-intercept, feature-gate]
key_files:
  created: []
  modified:
    - src/pages/Dashboard.tsx
decisions:
  - "isAtGuestLimit uses >= so that reaching the limit (not exceeding) triggers the paywall"
  - "Buttons remain clickable visually — modal explains the upgrade path rather than disabling UI"
  - "Coming Soon toast uses existing setToast pattern, not a separate showToast abstraction"
metrics:
  duration: 2 minutes
  completed: 2026-03-16T19:58:30Z
  tasks_completed: 2
  files_modified: 1
---

# Phase 05 Plan 02: Dashboard Paywall Intercepts Summary

**One-liner:** 5 paywall intercepts in Dashboard.tsx gate Import, Export, Add Guest (limit), Send Message, and bulk Export behind UpgradeModal for draft events.

## What Was Built

Wired `UpgradeModal` into `Dashboard.tsx` so that draft event users encounter the upgrade prompt when attempting any of 5 premium actions. Active event users and super admins bypass all gates and use features normally.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add UpgradeModal state, import, isAtGuestLimit, and modal render | 0b8f73d |
| 2 | Wire 5 button intercepts (PAY-02 through PAY-06) | cc0cc71 |

## Implementation Details

### Task 1: UpgradeModal Integration

**Added to imports:**
```typescript
import UpgradeModal from '@/components/ui/UpgradeModal';
```

**Extended context/hook destructuring:**
```typescript
const { currentEvent, isLoading: eventLoading, isActive } = useEventContext();
const { canImportGuests, canExportGuests, canSendMessages, maxFreeGuests } = useFeatureAccess();
```

**New state:**
```typescript
const [upgradeOpen, setUpgradeOpen] = useState(false);
```

**Guest limit guard:**
```typescript
const isAtGuestLimit = !isActive && invitations.length >= maxFreeGuests;
```

**Modal render (before existing toast):**
```tsx
<UpgradeModal
  isOpen={upgradeOpen}
  onClose={() => setUpgradeOpen(false)}
  onUpgradeClick={() => {
    setUpgradeOpen(false);
    setToast('Coming Soon — שילוב עם שער תשלום בקרוב');
    setTimeout(() => setToast(null), 3000);
  }}
/>
```

### Task 2: 5 Button Intercepts

| Gate | Button | Condition | Handler |
|------|--------|-----------|---------|
| PAY-02 | ייבוא (header) | `canImportGuests` | `setIsUploadOpen(true)` |
| PAY-03 | ייצוא (header) | `canExportGuests` | `handleExportAll()` |
| PAY-04 | הוסף מוזמן | `isAtGuestLimit` (inverse) | `openModal()` |
| PAY-05 | שלח הודעה (bulk) | `canSendMessages` | `setIsMessageModalOpen(true)` |
| PAY-06 | ייצוא (bulk) | `canExportGuests` | `handleExportSelected()` |

## Verification Results

- TypeScript compiles cleanly (no errors)
- `setUpgradeOpen(true)` appears exactly 5 times in Dashboard.tsx
- `UpgradeModal` in import (line 41) and JSX render (line 1260)
- `isAtGuestLimit` uses `>=` operator (line 1066)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/pages/Dashboard.tsx: modified ✓
- Commit 0b8f73d: FOUND ✓
- Commit cc0cc71: FOUND ✓

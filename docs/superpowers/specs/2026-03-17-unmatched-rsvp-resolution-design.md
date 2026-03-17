# Unmatched RSVP Resolution Workspace — Design Spec

## Problem

When a guest submits an RSVP with a phone number that doesn't exist in the `invitations` table, the submission is saved in `arrival_permits` with `match_status = 'unmatched'`. Admins currently have no visibility into these orphaned submissions and no way to resolve them.

## Solution: Resolution Workspace Pattern

A two-layer UI pattern:
1. **Alert Banner** — conditional notification above the filter bar, visible only when unmatched RSVPs exist
2. **Resolution Sheet** — a side drawer workspace for reviewing and resolving each unmatched RSVP

The main guest table remains strictly `invitations`-based. Unmatched RSVPs are treated as a "to-do list" that admins clear through the Resolution Sheet.

---

## Database Changes

### Trigger Guard (migration update)

The `sync_arrival_to_invitation` BEFORE trigger must skip its phone-matching logic when the row has already been manually resolved by an admin. Without this, an admin UPDATE (e.g., linking permit to invitation A) would re-fire the trigger, which could overwrite `invitation_id` with a different match from its phone lookup.

**Add early return at the top of `sync_arrival_to_invitation()`:**
```sql
-- Skip trigger logic if admin has already resolved this permit
IF NEW.match_status = 'matched' AND NEW.invitation_id IS NOT NULL THEN
  RETURN NEW;
END IF;
```

### Postgres RPCs (atomic multi-table operations)

Both resolution actions must be atomic — updating `arrival_permits` and `invitations` in a single transaction. This follows the existing pattern used by `update_whatsapp_template`, `delete_dynamic_nudge`, etc.

**RPC: `link_permit_to_invitation(p_permit_id, p_invitation_id)`**
- `SECURITY DEFINER`, `SET search_path = public`
- Reads `attending` and `guests_count` from the permit row
- Updates `invitations`: `rsvp_status = CASE WHEN attending THEN 'attending' ELSE 'declined' END`, `confirmed_pax = CASE WHEN attending THEN guests_count ELSE 0 END`
- Updates `arrival_permits`: `invitation_id = p_invitation_id`, `match_status = 'matched'`
- Guard: only operates on permits with `match_status = 'unmatched'` (idempotent — no error if already matched, just no-op)
- `GRANT EXECUTE TO authenticated`

**RPC: `create_invitation_from_permit(p_permit_id)`**
- `SECURITY DEFINER`, `SET search_path = public`
- Reads permit data, inserts new `invitations` row: `group_name = full_name`, `phone_numbers = ARRAY[phone]`, `rsvp_status = CASE WHEN attending THEN 'attending' ELSE 'declined' END`, `confirmed_pax = CASE WHEN attending THEN guests_count ELSE 0 END`, `invited_pax = guests_count`
- Updates `arrival_permits`: `invitation_id = new_inv_id`, `match_status = 'matched'`
- Returns the new invitation `id`
- Guard: only operates on permits with `match_status = 'unmatched'`
- `GRANT EXECUTE TO authenticated`

---

## Component Architecture

### 1. UnmatchedBanner

**File:** `src/components/dashboard/UnmatchedBanner.tsx`

**Placement:** Between KPI cards (`mb-8` grid) and filter bar section in `Dashboard.tsx` (after line ~1379).

**Props:**
```typescript
interface UnmatchedBannerProps {
  count: number;          // Number of unmatched arrival_permits
  onResolve: () => void;  // Opens the Resolution Sheet
}
```

**Behavior:**
- Renders only when `count > 0`
- Not manually dismissible (disappears naturally when count reaches 0)
- Amber/warning color scheme consistent with the "pending" palette used elsewhere

**Visual:**
- Full-width bar with `rounded-lg`, amber-50 background, amber-600 border-r-4 (RTL accent)
- Icon: `AlertTriangle` from lucide-react
- Text: `יש ${count} אישורי הגעה הממתינים לסיווג`
- Button: `טפל עכשיו` (amber-600 solid button, right-aligned in RTL)

---

### 2. UnmatchedResolutionSheet

**File:** `src/components/dashboard/UnmatchedResolutionSheet.tsx`

**Props:**
```typescript
interface ArrivalPermit {
  id: number;
  event_id: string;
  full_name: string;
  phone: string;
  attending: boolean;
  needs_parking: boolean;
  guests_count: number;
  match_status: 'matched' | 'unmatched';
  invitation_id: string | null;
  created_at: string;
}

interface UnmatchedResolutionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  invitations: Invitation[];       // Existing invitations for linking
  onResolved: () => void;          // Callback to refresh dashboard data
}
```

**Sheet Configuration:**
- Uses existing `Sheet` primitive from `src/components/ui/sheet.tsx`
- `side="left"` (RTL — drawer slides from the left, consistent with `MessageHistorySheet`)
- Width: `w-[28rem] sm:w-[32rem]` (wider than default to accommodate action buttons)
- `dir="rtl"`

**Internal State:**
- Fetches `arrival_permits WHERE event_id = ? AND match_status = 'unmatched'` on open
- Local state: `permits: ArrivalPermit[]`, `loading: boolean`
- Per-row action state: `linkingId: number | null` (which row has the combobox open), `resolvingId: number | null` (which row has an in-flight RPC), `error: string | null`
- **Important:** The sheet must always read from the `invitations` prop directly — never snapshot it into local state. This ensures newly created invitations (from "Create New" on a prior card) appear in the combobox for subsequent cards without requiring a sheet close/reopen.

**Layout:**
```
┌─────────────────────────────────────┐
│ SheetHeader                         │
│   Title: "אישורים ממתינים לסיווג"    │
│   Description: "X אישורים ממתינים"   │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Permit Card                     │ │
│ │  Name: אייל כהן                 │ │
│ │  Phone: 054-1234567             │ │
│ │  Status: מגיע (3 אורחים)        │ │
│ │  Parking: כן                    │ │
│ │  Submitted: 17/03/2026 14:30    │ │
│ │                                 │ │
│ │  [שייך להזמנה קיימת] [צור חדש]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Permit Card (next...)           │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Per-Card Actions:**

**a) "שייך להזמנה קיימת" (Link to Existing)**
- Clicking toggles an inline combobox/search below the card
- Combobox filters `invitations` by `group_name` (type-ahead search)
- Each option shows: `group_name` + first phone number (for confirmation)
- On selection:
  1. Call `link_permit_to_invitation` RPC (atomic — updates both tables, maps `attending → 'attending'/'declined'`, sets `confirmed_pax = guests_count` when attending or `0` when declined)
  2. Remove the card from the local list with an exit animation
  3. Call `onResolved()` to refresh the parent (invitations + unmatchedCount)

**b) "צור הזמנה חדשה" (Create New)**
- On click (no additional modal — immediate action):
  1. Call `create_invitation_from_permit` RPC (atomic — inserts invitation, links permit, returns new invitation ID)
  2. Remove card, call `onResolved()`

**Error handling:** If an RPC fails, set `error` state with the message and keep the card visible so the admin can retry. Clear error on next action attempt.

**Empty State:**
- When all permits are resolved (list empty): checkmark icon + "הכל מסווג!" message
- Sheet can be closed; banner in Dashboard disappears automatically

---

### 3. Data Layer

**New functions in `src/lib/supabase.js`:**

```typescript
// Fetch unmatched arrival permits for an event
export async function fetchUnmatchedPermits(eventId: string): Promise<ArrivalPermit[]>

// Link a permit to an existing invitation (atomic RPC)
export async function linkPermitToInvitation(
  permitId: number,
  invitationId: string
): Promise<void>

// Create a new invitation from an unmatched permit (atomic RPC)
export async function createInvitationFromPermit(
  permitId: number
): Promise<string>  // returns new invitation ID
```

Note: `linkPermitToInvitation` and `createInvitationFromPermit` are thin wrappers around `supabase.rpc(...)`. The RPC functions handle reading permit data and performing the multi-table updates atomically. The client does not need to pass `attending`/`guestsCount` — the RPC reads them from the permit row.

**Unmatched count query** (for the banner):
- Fetched alongside the existing invitations query in Dashboard.tsx
- Uses `supabase.from('arrival_permits').select('id', { count: 'exact' }).eq('event_id', eventId).eq('match_status', 'unmatched')`
- Stored in Dashboard state as `unmatchedCount: number`

---

## State Flow in Dashboard.tsx

```
Dashboard mounts
  ├── fetch invitations (existing)
  ├── fetch unmatchedCount (new — lightweight count query)
  │
  ├── render KPI cards
  ├── render UnmatchedBanner (if count > 0)
  │     └── onClick → setResolutionOpen(true)
  ├── render filter bar + table (existing)
  │
  └── render UnmatchedResolutionSheet
        ├── open={resolutionOpen}
        ├── invitations={invitations}  (passed for linking combobox — always read directly, never snapshot)
        └── onResolved → re-fetch unmatchedCount + invitations
```

**New state in Dashboard.tsx:**
```typescript
const [unmatchedCount, setUnmatchedCount] = useState(0);
const [resolutionOpen, setResolutionOpen] = useState(false);
```

---

## Styling & Consistency

- Font: `font-brand` for all text, `font-danidin` for the sheet title
- Colors: amber palette for banner (consistent with "pending" status elsewhere), slate for cards
- RTL: all components use `dir="rtl"`, text-right alignment
- Transitions: cards slide out on resolution (CSS `transition` + conditional rendering)
- No GSAP — pure CSS transitions consistent with dashboard conventions

---

## Scope Exclusions

- No bulk resolution (one at a time keeps it simple and prevents mistakes)
- No "dismiss/ignore" action (every RSVP should be resolved — either linked or created)
- No editing of the permit data before linking (admin edits the invitation after linking via EditGuestSheet)
- No notification/toast on resolution (the card disappearing is sufficient feedback)

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260317160000_rsvp_architecture_refactor.sql` | **Update** — add trigger guard + two RPC functions |
| `src/components/dashboard/UnmatchedBanner.tsx` | **New** — alert banner component |
| `src/components/dashboard/UnmatchedResolutionSheet.tsx` | **New** — resolution sheet with permit cards + actions |
| `src/pages/Dashboard.tsx` | Add unmatchedCount state, fetch query, render banner + sheet |
| `src/lib/supabase.js` | Add `fetchUnmatchedPermits`, `linkPermitToInvitation`, `createInvitationFromPermit` |

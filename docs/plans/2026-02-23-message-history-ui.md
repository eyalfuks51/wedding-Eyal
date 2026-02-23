# Message History UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a WhatsApp message status badge column to the guest table and a slide-in drawer with the full per-guest message timeline, giving admins instant visibility into the WhatsApp queue from the Dashboard.

**Architecture:** Batch-fetch the latest `message_log` per invitation after the invitations table loads (one query, client-side reduce to a Map). When an admin clicks a badge, lazy-fetch the full log for that invitation and display it in a `<Sheet side="left">` drawer. All new state lives inside the existing `Dashboard` component; the Sheet is a new `src/components/ui/sheet.tsx` built on `@radix-ui/react-dialog`.

**Tech Stack:** React 19 + TypeScript, @radix-ui/react-dialog (new dep), Tailwind 3.4, Supabase JS v2, Lucide icons already in project.

---

## Task 1 — Install @radix-ui/react-dialog and create Sheet primitive

**Files:**
- Create: `src/components/ui/sheet.tsx`
- Modify: `package.json` (automatic via npm)

### Step 1: Install the dependency

```bash
npm install @radix-ui/react-dialog
```

Expected: package.json gains `"@radix-ui/react-dialog": "^1.x.x"` in dependencies.

### Step 2: Write `src/components/ui/sheet.tsx`

Create the file with this exact content:

```tsx
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const Sheet = Dialog.Root;
const SheetTrigger = Dialog.Trigger;
const SheetClose = Dialog.Close;
const SheetPortal = Dialog.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(({ className, ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

type Side = 'left' | 'right' | 'top' | 'bottom';

const SIDE_CLASSES: Record<Side, string> = {
  left:   'inset-y-0 left-0 h-full w-80 sm:w-96 border-r',
  right:  'inset-y-0 right-0 h-full w-80 sm:w-96 border-l',
  top:    'inset-x-0 top-0 w-full border-b',
  bottom: 'inset-x-0 bottom-0 w-full border-t',
};

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  side?: Side;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-white shadow-2xl outline-none overflow-y-auto',
        'transition-transform duration-300 ease-in-out',
        SIDE_CLASSES[side],
        className,
      )}
      {...props}
    >
      {children}
    </Dialog.Content>
  </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col px-6 py-4 border-b border-slate-100', className)} {...props} />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={cn('text-lg font-bold text-slate-800 font-danidin', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Description>) {
  return (
    <Dialog.Description
      className={cn('text-sm text-slate-500 font-brand mt-0.5', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
```

### Step 3: Verify TypeScript compiles cleanly

Run: `npm run build` (or open the file in VS Code and confirm zero LSP errors in the Problems panel).

Expected: No errors. If `@/lib/utils` path alias is unresolved, check `tsconfig.json` — the alias `@` → `src` should already be there (it is, since `@/components/ui/glass-card` is imported in Dashboard.tsx).

### Step 4: Commit

```bash
git add src/components/ui/sheet.tsx package.json package-lock.json
git commit -m "feat(ui): add Sheet drawer primitive (radix-dialog)"
```

---

## Task 2 — Add MessageLog type, 4 state vars, and batch useEffect

**Files:**
- Modify: `src/pages/Dashboard.tsx`
  - Add type ~line 41 (after `Invitation` interface)
  - Add state ~line 746 (after `toastVariant` state)
  - Add useEffect ~line 768 (after invitations useEffect)

### Step 1: Add `MessageLog` interface

After the closing `}` of the `Invitation` interface (currently ends at line 41), insert:

```ts
interface MessageLog {
  id:            string;
  invitation_id: string;
  phone:         string;
  message_type:  string;
  content:       string;
  status:        'pending' | 'sent' | 'failed';
  error_log:     string | null;
  scheduled_for: string | null;
  sent_at:       string | null;
  created_at:    string;
}
```

### Step 2: Add 4 new state variables

After the `toastVariant` state declaration (~line 746), add:

```ts
// ── Message history drawer ────────────────────────────────────────────────
const [latestMsgLogs,    setLatestMsgLogs]    = useState<Map<string, MessageLog>>(new Map());
const [drawerInvitation, setDrawerInvitation] = useState<Invitation | null>(null);
const [drawerLogs,       setDrawerLogs]       = useState<MessageLog[]>([]);
const [drawerLoading,    setDrawerLoading]    = useState(false);
```

### Step 3: Add batch useEffect for latest-per-invitation log

After the invitations `useEffect` block (the one that depends on `[event?.id]`, currently ends around line 768), add a new useEffect that fires when `invitations` changes:

```ts
// Batch-fetch the most-recent message_log for every invitation in one query.
// Reduces client-side to Map<invitation_id, MessageLog> for O(1) badge lookup.
useEffect(() => {
  if (!supabase || invitations.length === 0) {
    setLatestMsgLogs(new Map());
    return;
  }
  const ids = invitations.map(i => i.id);
  supabase
    .from('message_logs')
    .select('id, invitation_id, phone, message_type, content, status, error_log, scheduled_for, sent_at, created_at')
    .in('invitation_id', ids)
    .order('created_at', { ascending: false })
    .then(({ data }) => {
      const map = new Map<string, MessageLog>();
      (data ?? []).forEach(log => {
        // Keep only the first (newest) log encountered per invitation
        if (!map.has(log.invitation_id)) map.set(log.invitation_id, log as MessageLog);
      });
      setLatestMsgLogs(map);
    });
}, [invitations]);
```

> **Why no error handling?** Batch log fetch is best-effort — if it fails, badges show "טרם נשלח" (the graceful fallback). A console.error is sufficient; no user-facing error is warranted.

### Step 4: Verify TypeScript compiles cleanly

Run: `npm run build` — expect zero new errors. The only likely issue: ensure `invitations` is in the `useEffect` dependency array (it is, as written above).

### Step 5: Commit

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): MessageLog type + batch msg-log fetch"
```

---

## Task 3 — Add MsgStatusBadge component + new table column

**Files:**
- Modify: `src/pages/Dashboard.tsx`
  - Add `MsgStatusBadge` component ~line 181 (after `StatusBadge`)
  - Update `colSpan` constant ~line 958
  - Add column header ~line 1187 (after existing `סטטוס` header `<th>`)
  - Add column cell ~line 1278 (after existing `<StatusBadge>` cell)

### Step 1: Add `MsgStatusBadge` component

After the closing `}` of the `StatusBadge` component (currently ends ~line 180), insert:

```tsx
// ── Msg Status Badge ──────────────────────────────────────────────────────

const MSG_STATUS_MAP = {
  pending: { label: 'ממתין בתור', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  sent:    { label: 'נשלח',       classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:  { label: 'נכשל',       classes: 'bg-rose-100 text-rose-700 border-rose-200' },
  none:    { label: 'טרם נשלח',   classes: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;

interface MsgStatusBadgeProps {
  log:     MessageLog | undefined;
  onClick: () => void;
}

function MsgStatusBadge({ log, onClick }: MsgStatusBadgeProps) {
  const key    = (log?.status ?? 'none') as keyof typeof MSG_STATUS_MAP;
  const cfg    = MSG_STATUS_MAP[key] ?? MSG_STATUS_MAP.none;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-brand border whitespace-nowrap hover:opacity-80 transition-opacity ${cfg.classes}`}
    >
      {cfg.label}
    </button>
  );
}
```

### Step 2: Update colSpan

Find this line (~line 958):
```ts
const colSpan = hasSideOrGroup ? 6 : 5;
```
Change it to:
```ts
const colSpan = hasSideOrGroup ? 7 : 6;
```

### Step 3: Add column header

Find the existing `סטטוס` `<th>` (currently the last `<th>` before `</tr></thead>`, ~line 1184-1186):
```tsx
                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                    סטטוס
                  </th>
```

After it, add:
```tsx
                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                    סטטוס הודעה
                  </th>
```

### Step 4: Add column cell in each row

Find the existing Status cell (~line 1273-1276):
```tsx
                        {/* Status */}
                        <td className="px-4 py-4">
                          <StatusBadge status={inv.rsvp_status} />
                        </td>
```

After it, add:
```tsx
                        {/* Msg Status */}
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <MsgStatusBadge
                            log={latestMsgLogs.get(inv.id)}
                            onClick={() => setDrawerInvitation(inv)}
                          />
                        </td>
```

### Step 5: Verify visual result

Run: `npm run dev` → open `/dashboard` → the table should have a new rightmost column "סטטוס הודעה" with badges. Clicking a badge should do nothing yet (drawer not wired) — but no crash should occur.

### Step 6: Commit

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): MsgStatusBadge column in guest table"
```

---

## Task 4 — Add MessageHistorySheet component + wire drawer

**Files:**
- Modify: `src/pages/Dashboard.tsx`
  - Add Sheet import ~line 24
  - Add `MessageHistorySheet` component ~line 714 (after `SendWhatsAppModal`)
  - Add lazy-fetch useEffect inside `Dashboard` ~line 770 (after batch fetch useEffect)
  - Mount `<MessageHistorySheet>` in JSX ~line 991 (after `<SendWhatsAppModal>`)

### Step 1: Add Sheet import

At line 24, after the `glass-card` import block, add:

```ts
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
```

### Step 2: Write `MessageHistorySheet` component

After the closing `}` of `SendWhatsAppModal` (~line 713), insert the following new component:

```tsx
// ── Message History Sheet ─────────────────────────────────────────────────

interface MessageHistorySheetProps {
  invitation:  Invitation | null;
  logs:        MessageLog[];
  loading:     boolean;
  onClose:     () => void;
}

function MessageHistorySheet({ invitation, logs, loading, onClose }: MessageHistorySheetProps) {
  const open = invitation !== null;

  // Format ISO timestamp → DD/MM/YYYY HH:mm (Israel-style)
  const formatTs = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const BORDER_COLOR: Record<string, string> = {
    pending: 'border-amber-400',
    sent:    'border-emerald-500',
    failed:  'border-rose-500',
  };

  return (
    <Sheet open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <SheetContent side="left" dir="rtl" className="font-brand flex flex-col">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <SheetHeader className="flex-row items-start justify-between">
          <div>
            <SheetTitle>היסטוריית הודעות</SheetTitle>
            {invitation?.group_name && (
              <SheetDescription>{invitation.group_name}</SheetDescription>
            )}
          </div>
          <SheetClose
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </SheetClose>
        </SheetHeader>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && logs.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-12">
              לא נמצאו הודעות עבור אורח זה
            </p>
          )}

          {!loading && logs.map(log => (
            <div
              key={log.id}
              className={`border-r-4 pr-3 py-2 space-y-1.5 ${BORDER_COLOR[log.status] ?? 'border-slate-300'}`}
            >
              {/* Top row: type chip + timestamp + status badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {TEMPLATE_LABELS[log.message_type] ?? log.message_type}
                </span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {formatTs(log.created_at)}
                </span>
              </div>

              {/* Message content */}
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                {log.content}
              </p>

              {/* Error box — only for failed */}
              {log.status === 'failed' && log.error_log && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                  {log.error_log}
                </p>
              )}
            </div>
          ))}

        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### Step 3: Add lazy-fetch useEffect inside `Dashboard`

After the batch useEffect (the one depending on `[invitations]`), add:

```ts
// Lazy-fetch full history for the invitation currently open in the drawer.
useEffect(() => {
  if (!supabase || !drawerInvitation) return;
  setDrawerLoading(true);
  setDrawerLogs([]);
  supabase
    .from('message_logs')
    .select('id, invitation_id, phone, message_type, content, status, error_log, scheduled_for, sent_at, created_at')
    .eq('invitation_id', drawerInvitation.id)
    .order('created_at', { ascending: false })
    .then(({ data }) => {
      setDrawerLogs((data ?? []) as MessageLog[]);
      setDrawerLoading(false);
    });
}, [drawerInvitation]);
```

### Step 4: Mount `<MessageHistorySheet>` in JSX

Find the `<SendWhatsAppModal ... />` block in the JSX (~line 985-991) and, immediately after its closing tag, add:

```tsx
      <MessageHistorySheet
        invitation={drawerInvitation}
        logs={drawerLogs}
        loading={drawerLoading}
        onClose={() => setDrawerInvitation(null)}
      />
```

### Step 5: Verify end-to-end behavior

Run: `npm run dev` → open `/dashboard`:

1. Table loads → batch fetch fires → badge states update
2. Click a badge in the "סטטוס הודעה" column → drawer slides in from left
3. Drawer shows timeline (or spinner while loading, or empty state)
4. Clicking outside the drawer / pressing Escape → drawer closes
5. Row-click still toggles checkbox selection (badge click is isolated via `stopPropagation`)

### Step 6: Verify TypeScript

Run: `npm run build` → expect zero errors.

### Step 7: Commit

```bash
git add src/pages/Dashboard.tsx src/components/ui/sheet.tsx
git commit -m "feat(dashboard): MessageHistorySheet drawer with timeline"
```

---

## Summary

| Task | Files changed | Commit |
|------|--------------|--------|
| 1 — Sheet primitive | `sheet.tsx`, `package.json` | `feat(ui): add Sheet drawer primitive` |
| 2 — Data layer | `Dashboard.tsx` | `feat(dashboard): MessageLog type + batch msg-log fetch` |
| 3 — Badge column | `Dashboard.tsx` | `feat(dashboard): MsgStatusBadge column in guest table` |
| 4 — Drawer + wiring | `Dashboard.tsx` | `feat(dashboard): MessageHistorySheet drawer with timeline` |

**Total new lines:** ~130 in Dashboard.tsx, ~80 in sheet.tsx. No existing logic modified beyond `colSpan` and the two column additions.

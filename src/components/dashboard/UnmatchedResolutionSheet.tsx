import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Link2, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchUnmatchedPermits,
  linkPermitToInvitation,
  createInvitationFromPermit,
} from '@/lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { type Invitation } from '@/components/dashboard/EditGuestSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  invitations: Invitation[]; // Read directly from prop, NEVER copy to local state
  onResolved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UnmatchedResolutionSheet({
  open,
  onOpenChange,
  eventId,
  invitations,
  onResolved,
}: UnmatchedResolutionSheetProps) {
  const [permits, setPermits] = useState<ArrivalPermit[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch unmatched permits when sheet opens
  useEffect(() => {
    if (open && eventId) {
      setLoading(true);
      fetchUnmatchedPermits(eventId)
        .then((data: ArrivalPermit[]) => {
          setPermits(data);
        })
        .catch(() => {
          setError('שגיאה בטעינת האישורים');
        })
        .finally(() => {
          setLoading(false);
        });
    }

    if (!open) {
      // Reset transient state when sheet closes
      setLinkingId(null);
      setLinkSearch('');
      setError(null);
    }
  }, [open, eventId]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleLink(permitId: number, invitationId: string) {
    setResolvingId(permitId);
    setError(null);
    try {
      await linkPermitToInvitation(permitId, invitationId);
      setPermits((prev) => prev.filter((p) => p.id !== permitId));
      onResolved();
    } catch {
      setError('שגיאה בשיוך האישור. נסה שנית.');
    } finally {
      setResolvingId(null);
      setLinkingId(null);
    }
  }

  async function handleCreateNew(permitId: number) {
    setResolvingId(permitId);
    setError(null);
    try {
      await createInvitationFromPermit(permitId);
      setPermits((prev) => prev.filter((p) => p.id !== permitId));
      onResolved();
    } catch {
      setError('שגיאה ביצירת ההזמנה. נסה שנית.');
    } finally {
      setResolvingId(null);
    }
  }

  // ─── Filtered invitations for combobox ──────────────────────────────────────

  const filteredInvitations = invitations.filter((inv) =>
    (inv.group_name ?? '').toLowerCase().includes(linkSearch.toLowerCase()),
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" dir="rtl" className="w-[28rem] sm:w-[32rem] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="font-danidin">אישורים ממתינים לסיווג</SheetTitle>
            <SheetClose asChild>
              <button
                className="rounded-md p-1 hover:bg-slate-100 transition-colors"
                aria-label="סגור"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </SheetClose>
          </div>
          <SheetDescription className="font-brand">
            {permits.length} אישורים ממתינים
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4">
          {/* Error banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-brand rounded-md px-3 py-2 mb-3">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
              <span className="text-sm text-slate-500 font-brand">טוען...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && permits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <span className="font-danidin text-lg text-slate-700">הכל מסווג!</span>
            </div>
          )}

          {/* Permit cards */}
          {!loading &&
            permits.map((permit) => {
              const isLinking = linkingId === permit.id;
              const isResolving = resolvingId === permit.id;

              return (
                <div
                  key={permit.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 mb-3 font-brand"
                >
                  {/* Name */}
                  <div className="text-base font-medium text-slate-900 text-right">
                    {permit.full_name}
                  </div>

                  {/* Phone */}
                  <div className="text-sm text-slate-500 text-right mt-0.5" dir="ltr">
                    {permit.phone}
                  </div>

                  {/* Attending status */}
                  <div className="text-sm text-right mt-1">
                    {permit.attending ? (
                      <span className="text-emerald-600">
                        מגיע ({permit.guests_count} אורחים)
                      </span>
                    ) : (
                      <span className="text-rose-600">לא מגיע/ה</span>
                    )}
                  </div>

                  {/* Parking */}
                  {permit.needs_parking && (
                    <div className="text-sm text-slate-500 text-right mt-0.5">חניה: כן</div>
                  )}

                  {/* Submitted date */}
                  <div className="text-xs text-slate-400 text-right mt-0.5">
                    {new Date(permit.created_at).toLocaleDateString('he-IL')}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {/* Link to existing invitation */}
                    <button
                      className="border border-violet-300 text-violet-700 hover:bg-violet-50 rounded-md px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setLinkingId(isLinking ? null : permit.id)}
                      disabled={resolvingId !== null}
                    >
                      {isResolving && isLinking ? (
                        <Loader2 className="animate-spin w-4 h-4" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      שייך להזמנה קיימת
                    </button>

                    {/* Create new invitation */}
                    <button
                      className="bg-violet-600 hover:bg-violet-700 text-white rounded-md px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleCreateNew(permit.id)}
                      disabled={resolvingId !== null}
                    >
                      {isResolving && !isLinking ? (
                        <Loader2 className="animate-spin w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      צור הזמנה חדשה
                    </button>
                  </div>

                  {/* Inline combobox for linking */}
                  {isLinking && (
                    <div className="mt-2">
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-brand"
                        placeholder="חפש לפי שם..."
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                        dir="rtl"
                      />
                      <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md mt-1">
                        {filteredInvitations.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-slate-400 text-right font-brand">
                            לא נמצאו תוצאות
                          </div>
                        ) : (
                          filteredInvitations.map((inv) => (
                            <button
                              key={inv.id}
                              className="w-full text-right px-3 py-2 hover:bg-violet-50 text-sm transition-colors"
                              onClick={() => handleLink(permit.id, inv.id)}
                            >
                              <div className="font-brand text-slate-800">
                                {inv.group_name ?? '—'}
                              </div>
                              <div className="text-xs text-slate-400" dir="ltr">
                                {inv.phone_numbers?.[0] ?? ''}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

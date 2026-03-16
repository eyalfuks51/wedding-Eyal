import { useEventContext } from '@/contexts/EventContext';
import { useAuth } from '@/contexts/AuthContext';

const FREE_GUEST_LIMIT = 20;

export function useFeatureAccess() {
  const { isActive } = useEventContext();
  const { isSuperAdmin } = useAuth();
  const unlocked = isSuperAdmin || isActive;

  return {
    canAccessSettings:  true as const,      // GATE-01: always open
    canAccessTimeline:  unlocked,            // GATE-02
    canImportGuests:    unlocked,            // GATE-03
    canExportGuests:    unlocked,            // GATE-04
    canSendMessages:    unlocked,            // GATE-05
    maxFreeGuests:      FREE_GUEST_LIMIT,    // GATE-06
  };
}

import { useEventContext } from '@/contexts/EventContext';

export function useFeatureAccess() {
  const { isActive } = useEventContext();
  return {
    canManageGuests: isActive,
    canUseWhatsApp:  isActive,
  };
}

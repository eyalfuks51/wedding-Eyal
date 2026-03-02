import { useLocation, useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

const ALL_TABS = [
  { path: '/dashboard',          label: 'אורחים',  requiresActive: true  },
  { path: '/dashboard/timeline', label: 'ציר זמן', requiresActive: true  },
  { path: '/dashboard/settings', label: 'הגדרות',  requiresActive: false },
] as const;

export default function DashboardNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canManageGuests } = useFeatureAccess();

  const tabs = ALL_TABS.filter(tab => !tab.requiresActive || canManageGuests);

  return (
    <nav dir="rtl" className="flex gap-1 bg-white/60 backdrop-blur-sm rounded-xl p-1 mb-6 w-fit font-brand">
      {tabs.map(tab => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={[
              'px-5 py-2 rounded-lg text-sm font-medium transition-all',
              active
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-violet-600 hover:bg-white/80',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

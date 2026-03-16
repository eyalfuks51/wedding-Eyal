import { useLocation, useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import EventSwitcher from './EventSwitcher';

const ALL_TABS = [
  { path: '/dashboard',          label: 'אורחים',  gateKey: null                           },
  { path: '/dashboard/timeline', label: 'ציר זמן', gateKey: 'canAccessTimeline' as const   },
  { path: '/dashboard/settings', label: 'הגדרות',  gateKey: null                           },
] as const;

export default function DashboardNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useFeatureAccess();

  const tabs = ALL_TABS.filter(tab => !tab.gateKey || access[tab.gateKey]);

  return (
    <div dir="rtl" className="mb-6 font-brand">
      <EventSwitcher />
      <nav className="flex gap-1 bg-white/60 backdrop-blur-sm rounded-xl p-1 w-fit mt-2">
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
    </div>
  );
}

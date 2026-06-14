import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import EventSwitcher from './EventSwitcher';

const ALL_TABS = [
  { path: '/dashboard',          label: 'אורחים',   gateKey: null                           },
  { path: '/dashboard/timeline', label: 'פייפליין', gateKey: 'canAccessTimeline' as const  },
  { path: '/dashboard/settings', label: 'הגדרות',   gateKey: null                           },
] as const;

export default function DashboardNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const access   = useFeatureAccess();

  const tabs = ALL_TABS.filter(tab => !tab.gateKey || access[tab.gateKey]);

  return (
    <header
      dir="rtl"
      className="dashboard-nav sticky top-0 z-50 font-brand"
      style={{
        background: 'linear-gradient(90deg, oklch(99.5% 0.012 75 / 0.82), oklch(98% 0.018 78 / 0.64))',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--glass-line)',
        boxShadow: '0 1px 0 oklch(100% 0.005 75 / 0.55) inset, 0 14px 34px -32px oklch(32% 0.04 52 / 0.38)',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        gap: '28px',
        padding: '0 34px',
      }}
    >
      {/* Brand */}
      <div
        className="dashboard-nav-brand flex items-baseline gap-2 font-danidin font-bold text-2xl tracking-wide shrink-0"
        style={{ color: 'var(--ink)' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: 'var(--rose-gold)', marginBottom: '2px', boxShadow: '0 0 0 4px oklch(72% 0.115 20 / 0.16)' }}
        />
        Guesto
      </div>

      {/* Tabs */}
      <nav
        className="dashboard-nav-tabs flex gap-1"
        style={{
          padding: '4px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--glass-line)',
          background: 'oklch(100% 0.006 75 / 0.45)',
          boxShadow: '0 1px 0 oklch(100% 0.005 75 / 0.55) inset',
        }}
      >
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="dashboard-nav-tab px-4 py-2 text-sm font-medium transition-all duration-200 rounded-xl"
              style={active ? {
                color: 'var(--violet-700)',
                background: 'linear-gradient(180deg, oklch(99% 0.015 301 / 0.92), var(--violet-50))',
                border: '1px solid oklch(78% 0.09 300 / 0.34)',
                boxShadow: '0 10px 24px -18px var(--violet-700), 0 1px 0 oklch(100% 0.005 75 / 0.8) inset',
              } : {
                color: 'var(--ink-soft)',
                background: 'transparent',
                border: '1px solid transparent',
                boxShadow: 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="dashboard-nav-spacer flex-1" />

      {/* Event switcher */}
      <EventSwitcher />

      {/* Notification bell */}
      <button
        className="dashboard-nav-bell flex items-center justify-center rounded-lg transition-all duration-200"
        style={{
          width: '38px',
          height: '38px',
          color: 'var(--ink-soft)',
          border: '1px solid var(--glass-line)',
          background: 'oklch(100% 0.006 75 / 0.45)',
          boxShadow: '0 1px 0 oklch(100% 0.005 75 / 0.56) inset',
        }}
        aria-label="התראות"
      >
        <Bell className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
      </button>
    </header>
  );
}

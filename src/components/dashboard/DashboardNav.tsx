import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Users, Workflow, Settings, User, LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import Logo from '@/components/brand/Logo';
import EventSwitcher from './EventSwitcher';

/**
 * Dashboard chrome — one component, two layouts.
 *
 * Desktop (md+): sticky topbar with logo · segmented tabs · event switcher ·
 *   sign-out · bell. Active tab = violet pill (route-driven).
 * Mobile (< md): compact sticky topbar ([account] · logo · bell) + a fixed
 *   bottom nav for the 3 sections. One nav method only — no duplicated tabs.
 *
 * Routes, gating and exact-match active logic are shared (ALL_TABS / useTabs)
 * so both layouts stay in lockstep. The super-admin event switcher lives in the
 * mobile account menu and self-hides for regular users, so it never crowds the
 * compact header.
 */

interface TabDef {
  path: string;
  label: string;
  icon: LucideIcon;
  gateKey: 'canAccessTimeline' | null;
}

const ALL_TABS: TabDef[] = [
  { path: '/dashboard',          label: 'אורחים',   icon: Users,    gateKey: null               },
  { path: '/dashboard/timeline', label: 'פייפליין', icon: Workflow, gateKey: 'canAccessTimeline' },
  { path: '/dashboard/settings', label: 'הגדרות',   icon: Settings, gateKey: null               },
];

/** Visible tabs after feature-gating — single source for both layouts. */
function useTabs(): TabDef[] {
  const access = useFeatureAccess();
  return ALL_TABS.filter(tab => !tab.gateKey || access[tab.gateKey]);
}

// ── Shared chrome tokens ─────────────────────────────────────────────
const HEADER_GLASS: React.CSSProperties = {
  background: 'linear-gradient(90deg, oklch(99.5% 0.012 292 / 0.82), oklch(98% 0.018 292 / 0.64))',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  borderBottom: '1px solid var(--glass-line)',
  boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.55) inset, 0 14px 34px -32px oklch(32% 0.04 292 / 0.38)',
};

// Bottom tab bar shares the header's glass material (same blur + line token),
// mirrored to sit at the bottom: border + sheen on the TOP edge, faint upward
// lift. Keeps the two chrome bars reading as one material, not two.
const BOTTOM_NAV_GLASS: React.CSSProperties = {
  background: 'linear-gradient(180deg, oklch(99.5% 0.012 292 / 0.82), oklch(98% 0.018 292 / 0.64))',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  borderTop: '1px solid var(--glass-line)',
  boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.55) inset, 0 -14px 34px -32px oklch(32% 0.04 292 / 0.38)',
};

const GLASS_CARD: React.CSSProperties = {
  background: 'var(--glass-card)',
  backdropFilter: 'var(--glass-card-blur)',
  WebkitBackdropFilter: 'var(--glass-card-blur)',
  border: '1px solid var(--glass-line)',
  boxShadow: 'var(--shadow-float)',
};

const iconButton = (active = false): React.CSSProperties => ({
  width: '40px',
  height: '40px',
  color: 'var(--ink-soft)',
  border: '1px solid var(--glass-line)',
  background: active ? 'oklch(100% 0.006 292 / 0.78)' : 'oklch(100% 0.006 292 / 0.45)',
  boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.56) inset',
});

export default function DashboardNav() {
  return (
    <>
      <DesktopTopbar />
      <MobileTopbar />
      <MobileBottomNav />
    </>
  );
}

// ── Desktop (md+) ────────────────────────────────────────────────────
function DesktopTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = useTabs();
  const { signOut } = useAuth();

  return (
    <header
      dir="rtl"
      className="dashboard-nav hidden min-[921px]:flex items-center gap-7 sticky top-0 z-50 font-brand px-8"
      style={{ ...HEADER_GLASS, height: '68px' }}
    >
      {/* Brand */}
      <div className="dashboard-nav-brand flex items-center shrink-0">
        <Logo variant="onLight" className="h-[40px]" />
      </div>

      {/* Tabs */}
      <nav
        className="dashboard-nav-tabs flex gap-1 p-1"
        style={{
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--glass-line)',
          background: 'oklch(100% 0.006 292 / 0.45)',
          boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.55) inset',
        }}
      >
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-current={active ? 'page' : undefined}
              className="dashboard-nav-tab px-4 py-2 text-sm font-medium transition-all duration-200 rounded-xl"
              style={active ? {
                color: 'var(--violet-700)',
                background: 'linear-gradient(180deg, oklch(99% 0.015 292 / 0.92), var(--violet-50))',
                border: '1px solid oklch(78% 0.09 292 / 0.34)',
                boxShadow: '0 10px 24px -18px var(--violet-700), 0 1px 0 oklch(100% 0.005 292 / 0.8) inset',
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

      {/* Event switcher (super-admin / multi-event only — self-hides otherwise) */}
      <EventSwitcher />

      {/* Sign out */}
      <button
        type="button"
        onClick={() => { void signOut(); }}
        className="dashboard-nav-signout px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg"
        style={{
          color: 'var(--ink-soft)',
          border: '1px solid var(--glass-line)',
          background: 'oklch(100% 0.006 292 / 0.45)',
          boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.56) inset',
        }}
        aria-label="התנתקות"
      >
        התנתקות
      </button>

      {/* Notification bell */}
      <button
        className="dashboard-nav-bell flex items-center justify-center rounded-lg transition-all duration-200"
        style={iconButton()}
        aria-label="התראות"
      >
        <Bell style={{ width: '18px', height: '18px' }} />
      </button>
    </header>
  );
}

// ── Mobile (< md): compact topbar ────────────────────────────────────
function MobileTopbar() {
  return (
    <header
      dir="rtl"
      className="dashboard-nav-mobile flex min-[921px]:hidden items-center justify-between sticky top-0 z-50 font-brand px-3.5"
      style={{ ...HEADER_GLASS, height: '54px' }}
    >
      <AccountMenu />

      <Logo variant="onLight" height={30} />

      <button
        className="flex items-center justify-center rounded-lg transition-transform duration-150 active:scale-95"
        style={iconButton()}
        aria-label="התראות"
      >
        <Bell style={{ width: '18px', height: '18px' }} />
      </button>
    </header>
  );
}

/**
 * Compact account control for the mobile topbar. Holds the things that would
 * otherwise crowd the bar: the super-admin event switcher (renders nothing for
 * regular users) and sign-out.
 */
function AccountMenu() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside + Escape dismiss (matches EventSwitcher pattern)
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center rounded-lg transition-transform duration-150 active:scale-95"
        style={iconButton(open)}
        aria-label="חשבון"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User style={{ width: '18px', height: '18px' }} />
      </button>

      {open && (
        <div
          className="account-menu absolute z-50 mt-2 right-0 min-w-[220px] rounded-2xl p-1.5 flex flex-col gap-1"
          style={GLASS_CARD}
          role="menu"
        >
          {/* Super-admin / multi-event switcher — renders null for regular users.
              Wrapper isolates it from the legacy `.dashboard-event-switcher`
              mobile flex rules (order/margin) authored for the old single-row
              header, so it can't reorder itself below sign-out here. */}
          <div className="account-menu-switcher">
            <EventSwitcher />
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); void signOut(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-right transition-colors"
            style={{ color: 'var(--ink-soft)' }}
            role="menuitem"
          >
            <LogOut size={16} />
            <span>התנתקות</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Mobile (< 921px): soft iOS-style tab bar ─────────────────────────
/**
 * A quiet, flush tab bar — full width, thin top border, no card / pill /
 * shadow / icon circle. It shares the header's glass material (BOTTOM_NAV_GLASS)
 * so the top and bottom chrome read as one surface, not two.
 *
 * Active section is just a Guesto-violet (`--violet-700`, same token as the
 * desktop active tab) icon + label; inactive is muted ink that warms on hover.
 * Color carries the active signal — no indicator dot/line, so it recedes rather
 * than competing with page buttons. Press dims like a native tab; keyboard focus
 * gets a violet ring (the shared SiteFooter ring token).
 *
 * Route order + exact-path active logic are the shared `useTabs()` set, same
 * as the desktop bar. RTL preserved.
 */
function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = useTabs();

  return (
    <nav
      dir="rtl"
      aria-label="ניווט ראשי"
      className="dashboard-bottom-nav flex min-[921px]:hidden items-stretch fixed inset-x-0 bottom-0 z-50 font-brand"
      style={{ minHeight: '64px', paddingBottom: 'env(safe-area-inset-bottom)', ...BOTTOM_NAV_GLASS }}
    >
      {tabs.map(tab => {
        const active = location.pathname === tab.path;
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            aria-current={active ? 'page' : undefined}
            className={[
              // preflight:false → must kill native button chrome (grey fill / border /
              // radius) ourselves; siblings do it via inline bg+border, this bar is flat.
              'flex-1 flex flex-col items-center justify-center gap-1 select-none',
              'appearance-none bg-transparent border-0 p-0 cursor-pointer',
              'transition-[color,opacity] duration-200 active:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
              'focus-visible:ring-[oklch(0.52_0.22_292_/_0.45)]',
              active ? 'text-[var(--violet-700)]' : 'text-ink-mute hover:text-ink-soft',
            ].join(' ')}
          >
            <Icon size={22} strokeWidth={active ? 2.25 : 2} />
            <span className={`text-[11px] ${active ? 'font-semibold' : 'font-medium'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

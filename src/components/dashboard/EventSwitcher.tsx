import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { useEventContext, type EventData } from '@/contexts/EventContext';
import { useAuth } from '@/contexts/AuthContext';

function eventLabel(event: EventData): string {
  if (event.partner1_name && event.partner2_name) {
    return `${event.partner1_name} & ${event.partner2_name}`;
  }
  return event.slug;
}

export default function EventSwitcher() {
  const { events, currentEvent, switchEvent } = useEventContext();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside dismiss (same pattern as Dashboard.tsx column visibility dropdown)
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const showSwitcher = events.length > 1 || isSuperAdmin;
  if (!showSwitcher) return null;

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-white/80 transition-colors font-brand"
      >
        <span>{currentEvent ? eventLabel(currentEvent) : 'בחר אירוע'}</span>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[220px] max-h-64 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200">
          {/* Event list */}
          <div className="py-1">
            {events.map(event => {
              const isCurrent = event.id === currentEvent?.id;
              return (
                <button
                  key={event.id}
                  onClick={() => {
                    switchEvent(event.id);
                    setOpen(false);
                  }}
                  className={[
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors text-right',
                    isCurrent
                      ? 'bg-violet-50 text-violet-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span>{eventLabel(event)}</span>
                  <span
                    className={[
                      'text-xs px-1.5 py-0.5 rounded-full',
                      event.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700',
                    ].join(' ')}
                  >
                    {event.status === 'active' ? 'פעיל' : 'טיוטה'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Create New Event footer */}
          <div className="border-t border-slate-100">
            <button
              onClick={() => {
                navigate('/onboarding');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-violet-600 hover:bg-violet-50 transition-colors"
            >
              <Plus size={16} />
              <span>אירוע חדש</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

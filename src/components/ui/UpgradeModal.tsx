import { useEffect } from 'react';
import { Crown, Check } from 'lucide-react';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardContent,
  GlassCardFooter,
} from '@/components/ui/glass-card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeClick: () => void; // Parent handles toast
}

// ─── Benefits ─────────────────────────────────────────────────────────────────

const BENEFITS = [
  'אורחים ללא הגבלה',
  'ייבוא וייצוא אקסל',
  'אוטומציית וואטסאפ',
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function UpgradeModal({ isOpen, onClose, onUpgradeClick }: UpgradeModalProps) {
  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onUpgradeClick();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md mx-4" dir="rtl">
          <GlassCard className="rounded-3xl shadow-2xl">
            {/* Header */}
            <GlassCardHeader className="flex-col items-center text-center gap-3 pt-8 pb-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Crown className="w-7 h-7 text-violet-600" />
              </div>
              <div className="font-danidin text-xl text-slate-900">
                שדרגו לגרסה המלאה
              </div>
            </GlassCardHeader>

            {/* Benefits list */}
            <GlassCardContent className="py-4">
              <ul className="space-y-3">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 font-brand text-slate-700">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-violet-600" />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </GlassCardContent>

            {/* Actions */}
            <GlassCardFooter className="flex-col gap-3 pt-4 pb-8">
              <button
                onClick={handleUpgrade}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6 py-3 w-full font-medium font-brand transition-colors"
              >
                שדרגו עכשיו
              </button>
              <button
                onClick={onClose}
                className="text-slate-500 text-sm font-brand hover:text-slate-700 transition-colors"
              >
                אולי אחר כך
              </button>
            </GlassCardFooter>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

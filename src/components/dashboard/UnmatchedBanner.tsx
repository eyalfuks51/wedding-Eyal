import { AlertTriangle } from 'lucide-react';

interface UnmatchedBannerProps {
  count: number;
  onResolve: () => void;
}

export default function UnmatchedBanner({ count, onResolve }: UnmatchedBannerProps) {
  if (count === 0) return null;

  return (
    <div
      dir="rtl"
      className="rounded-lg bg-amber-50 border border-amber-200 border-r-4 border-r-amber-500 px-4 py-3 mb-6 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <span className="font-brand text-sm text-amber-800">
          יש {count} אישורי הגעה הממתינים לסיווג
        </span>
      </div>
      <button
        onClick={onResolve}
        className="font-brand text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md px-4 py-1.5 transition-colors"
      >
        טפל עכשיו
      </button>
    </div>
  );
}

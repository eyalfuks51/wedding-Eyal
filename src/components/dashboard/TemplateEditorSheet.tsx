import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { STAGE_META, type StageName } from '@/components/dashboard/constants';
import { updateWhatsAppTemplate } from '@/lib/supabase';

type WhatsAppTemplates = Record<string, { singular: string; plural: string }>;

interface TemplateEditorSheetProps {
  stageName: StageName | null;
  templates: WhatsAppTemplates;
  eventId: string;
  onClose: () => void;
  onSaved: (stageName: StageName, singular: string, plural: string) => void;
}

const INPUT_CLS = [
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-brand',
  'text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400',
  'focus:border-transparent transition-shadow',
].join(' ');

export default function TemplateEditorSheet({
  stageName,
  templates,
  eventId,
  onClose,
  onSaved,
}: TemplateEditorSheetProps) {
  const [singular, setSingular] = useState('');
  const [plural, setPlural]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Sync textarea values whenever the sheet opens or templates change
  useEffect(() => {
    if (!stageName) return;
    const t = templates[stageName];
    setSingular(t?.singular ?? '');
    setPlural(t?.plural ?? '');
    setError('');
  }, [stageName, templates]);

  const handleSave = async () => {
    if (!stageName) return;
    setSaving(true);
    setError('');
    try {
      // Atomic server-side patch via Postgres RPC (jsonb_set).
      // Only touches content_config -> whatsapp_templates -> <stageName>.
      await updateWhatsAppTemplate(eventId, stageName, singular, plural);
      onSaved(stageName, singular, plural);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הטקסט');
    } finally {
      setSaving(false);
    }
  };

  const label = stageName ? STAGE_META[stageName].label : '';

  return (
    <Sheet open={stageName !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="left" dir="rtl" className="font-brand flex flex-col w-[30rem] p-0">
        <SheetHeader>
          <SheetTitle className="font-danidin text-lg">
            עריכת טקסט — {label}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Variable hints */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-600 mb-1">משתנים זמינים:</p>
            <code className="font-mono">{'{{name}}'}</code>
            {' · '}
            <code className="font-mono">{'{{couple_names}}'}</code>
            {' · '}
            <code className="font-mono">{'{{link}}'}</code>
            {' · '}
            <code className="font-mono">{'{{waze_link}}'}</code>
          </div>

          {/* Singular */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 font-brand">
              טקסט ליחיד
              <span className="text-xs text-slate-400 font-normal mr-1">(invited_pax = 1)</span>
            </label>
            <textarea
              value={singular}
              onChange={e => setSingular(e.target.value)}
              rows={6}
              placeholder="הזן את הטקסט כאן..."
              className={INPUT_CLS}
            />
            <p className="text-xs text-slate-400">{singular.length} תווים</p>
          </div>

          {/* Plural */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 font-brand">
              טקסט לרבים
              <span className="text-xs text-slate-400 font-normal mr-1">(invited_pax &gt; 1)</span>
            </label>
            <textarea
              value={plural}
              onChange={e => setPlural(e.target.value)}
              rows={6}
              placeholder="הזן את הטקסט כאן..."
              className={INPUT_CLS}
            />
            <p className="text-xs text-slate-400">{plural.length} תווים</p>
          </div>

          {error && (
            <p className="text-sm text-rose-600 font-brand bg-rose-50 rounded-xl px-3 py-2 border border-rose-200">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium font-brand transition-colors"
            >
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium font-brand transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

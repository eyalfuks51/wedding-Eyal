import { useMemo } from 'react';
import WeddingDefaultTemplate from '@/templates/WeddingDefaultTemplate/WeddingDefaultTemplate';
import ElegantTemplate from '@/templates/ElegantTemplate/ElegantTemplate';

const TEMPLATES: Record<string, React.ComponentType<{ event: any; config: any }>> = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
};

// iPhone-like viewport dimensions
const PHONE_W = 375;
const PHONE_H = 812;

interface LivePreviewProps {
  templateId: string;
  event: { id: string; slug: string; template_id: string; event_date: string };
  config: Record<string, any>;
  /** Width of the container in pixels — scale is computed from this */
  width?: number;
}

export default function LivePreview({ templateId, event, config, width = 320 }: LivePreviewProps) {
  const scale = width / PHONE_W;
  const frameH = PHONE_H * scale;

  const Template = TEMPLATES[templateId] ?? WeddingDefaultTemplate;

  // Merge draft config with event for the template contract
  const previewEvent = useMemo(() => ({
    ...event,
    content_config: config,
  }), [event, config]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone frame */}
      <div
        className="relative rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden"
        style={{ width: `${width + 12}px`, height: `${frameH + 12}px` }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-xl z-10" />

        {/* Scaled template content */}
        <div
          className="origin-top-right overflow-y-auto overflow-x-hidden pointer-events-none bg-white"
          dir="rtl"
          style={{
            width: `${PHONE_W}px`,
            height: `${PHONE_H}px`,
            transform: `scale(${scale})`,
          }}
        >
          <Template event={previewEvent} config={config} />
        </div>
      </div>

      <p className="text-[11px] text-slate-400 font-brand">תצוגה מקדימה</p>
    </div>
  );
}

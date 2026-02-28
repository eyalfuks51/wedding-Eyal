import { useMemo } from 'react';
import WeddingDefaultTemplate from '@/templates/WeddingDefaultTemplate/WeddingDefaultTemplate';
import ElegantTemplate from '@/templates/ElegantTemplate/ElegantTemplate';

const TEMPLATES: Record<string, React.ComponentType<{ event: any; config: any }>> = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
};

// iPhone-like viewport dimensions used as the "phone viewport"
const PHONE_W = 375;
const PHONE_H = 812;

/**
 * CSS injected into the preview scope to neutralise layout side-effects that
 * only make sense in a real browser viewport (not a scaled div):
 *
 *  1. 100dvh  — resolves to the browser viewport, not the phone viewport.
 *               Override hero + root min-height to use px values instead.
 *
 *  2. GSAP    — ScrollTrigger animations start at opacity:0 and only fire when
 *               the scroll position crosses a threshold in the real window.
 *               Inside the scaled overflow container, those triggers never fire,
 *               leaving content invisible.  Override every animated element to
 *               full opacity + no transform so the preview always shows content.
 */
const PREVIEW_CSS = `
  .preview-scope .el {
    min-height: auto !important;
  }
  .preview-scope .el__hero {
    min-height: ${PHONE_H}px !important;
  }
  .preview-scope .el__schedule-item,
  .preview-scope .el__closing-block,
  .preview-scope .el__wine-divider,
  .preview-scope .el__asset--monstera,
  .preview-scope .el__asset--necklace,
  .preview-scope .el__reveal,
  .preview-scope .el__hero-content > * {
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
`;

interface LivePreviewProps {
  templateId: string;
  event: { id: string; slug: string; template_id: string; event_date: string };
  config: Record<string, any>;
  /** Width of the phone content area in pixels — scale is computed from this */
  width?: number;
}

export default function LivePreview({ templateId, event, config, width = 320 }: LivePreviewProps) {
  const scale  = width / PHONE_W;
  const frameH = PHONE_H * scale;

  const Template = TEMPLATES[templateId] ?? WeddingDefaultTemplate;

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-10" />

        {/* Scaled template — scroll allowed, clicks blocked */}
        <div
          className="origin-top-left overflow-y-auto overflow-x-hidden scrollbar-hide bg-white"
          dir="rtl"
          style={{
            width:     `${PHONE_W}px`,
            height:    `${PHONE_H}px`,
            transform: `scale(${scale})`,
          }}
        >
          {/* Scoped CSS overrides */}
          <style>{PREVIEW_CSS}</style>

          <div className="pointer-events-none preview-scope">
            <Template event={previewEvent} config={config} />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 font-brand">תצוגה מקדימה</p>
    </div>
  );
}

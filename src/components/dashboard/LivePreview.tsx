import { useEffect, useRef, useCallback } from 'react';

// Simulated phone viewport — matches a standard iPhone viewport
const PHONE_W = 375;
const PHONE_H = 812;

interface LivePreviewProps {
  event: { id: string; slug: string; template_id: string; event_date: string };
  config: Record<string, any>;
  /** Visual width of the phone content area in px — scale is computed from this */
  width?: number;
}

export default function LivePreview({ event, config, width = 320 }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Keep a ref to always post the latest config (avoids stale closure in onLoad)
  const latestConfig = useRef(config);
  const scale  = width / PHONE_W;
  const frameH = Math.round(PHONE_H * scale);

  // Always keep latestConfig in sync
  useEffect(() => {
    latestConfig.current = config;
  });

  const sendConfig = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'preview-config', config: latestConfig.current },
      window.location.origin,
    );
  }, []);

  // Resend on every config change (iframe may already be loaded)
  useEffect(() => {
    sendConfig();
  }, [config, sendConfig]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone frame shell */}
      <div
        className="relative rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden"
        style={{ width: `${width + 12}px`, height: `${frameH + 12}px` }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-10" />

        {/* iframe — full phone viewport, CSS-scaled to fit panel */}
        <iframe
          ref={iframeRef}
          src={`/preview/${event.slug}`}
          onLoad={sendConfig}
          title="תצוגה מקדימה"
          style={{
            display:         'block',
            width:           `${PHONE_W}px`,
            height:          `${PHONE_H}px`,
            border:          'none',
            transform:       `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents:   'none',
          }}
        />
      </div>

      <p className="text-[11px] text-slate-400 font-brand">תצוגה מקדימה</p>
    </div>
  );
}

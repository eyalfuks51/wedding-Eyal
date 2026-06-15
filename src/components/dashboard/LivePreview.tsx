import { useEffect, useRef, useCallback, useState } from 'react';

const PHONE_W = 375;
const PHONE_H = 812;

interface LivePreviewProps {
  event: { id: string; slug: string; template_id: string; event_date: string | null };
  config: Record<string, any>;
  /** Visual width of the phone outer chrome in px — content scales from this */
  width?: number;
  /** Whether to wrap with the glass preview-card chrome (head + tabs + footer) */
  showChrome?: boolean;
}

const PULSE_KEYFRAMES = `
@keyframes lp-pulse {
  0%   { box-shadow: 0 0 0 0    rgba(122,132,102,0.4); }
  70%  { box-shadow: 0 0 0 8px  rgba(122,132,102,0);   }
  100% { box-shadow: 0 0 0 0    rgba(122,132,102,0);   }
}
`;

export default function LivePreview({
  event,
  config,
  width = 320,
  showChrome = true,
}: LivePreviewProps) {
  const iframeRef     = useRef<HTMLIFrameElement>(null);
  const latestConfig  = useRef(config);
  const [mode, setMode] = useState<'mobile' | 'desktop'>('mobile');

  // Keep latestConfig in sync (avoids stale closure in onLoad)
  useEffect(() => { latestConfig.current = config; });

  const sendConfig = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'preview-config', config: latestConfig.current },
      window.location.origin,
    );
  }, []);

  // Resend on every config change
  useEffect(() => { sendConfig(); }, [config, sendConfig]);

  // Geometry: outer=width, padding 8px each side, screen scaled from 375
  const innerW = width - 16;
  const scale  = innerW / PHONE_W;
  const innerH = Math.round(PHONE_H * scale);
  const outerH = innerH + 16;

  // Phone chrome, full-pill notch, violet ring shadow, violet screen gradient
  const phone = (
    <div
      style={{
        position:     'relative',
        width:        `${width}px`,
        height:       `${outerH}px`,
        background:   'oklch(18% 0.012 292)',
        borderRadius: '32px',
        padding:      '8px',
        boxShadow:    '0 0 0 1.5px rgba(109,40,217,0.15), 0 12px 36px -12px rgba(42,37,32,0.35)',
        margin:       '0 auto',
      }}
    >
      {/* Notch */}
      <div
        aria-hidden
        style={{
          position:      'absolute',
          top:           '14px',
          left:          '50%',
          transform:     'translateX(-50%)',
          width:         '100px',
          height:        '22px',
          background:    'oklch(18% 0.012 292)',
          borderRadius:  '999px',
          zIndex:        10,
          pointerEvents: 'none',
        }}
      />
      {/* Screen — gradient backdrop visible behind iframe load */}
      <div
        style={{
          width:        '100%',
          height:       '100%',
          borderRadius: '24px',
          overflow:     'hidden',
          background:   'linear-gradient(180deg, #2a1f3d 0%, #4a2c5a 50%, #6b3e6e 100%)',
          position:     'relative',
        }}
      >
        <iframe
          ref={iframeRef}
          src={`/preview/${event.slug}`}
          onLoad={sendConfig}
          title="תצוגה מקדימה"
          style={{
            position:        'absolute',
            top:             0,
            left:            0,
            display:         'block',
            width:           `${PHONE_W}px`,
            height:          `${PHONE_H}px`,
            border:          'none',
            transform:       `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  );

  if (!showChrome) return phone;

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>
      <div
        style={{
          position:             'relative',
          background:           'linear-gradient(135deg, oklch(100% 0.004 292 / 0.97), oklch(99.5% 0.008 292 / 0.88))',
          backdropFilter:       'var(--glass-card-blur)',
          WebkitBackdropFilter: 'var(--glass-card-blur)',
          border:               '1px solid var(--glass-line)',
          borderRadius:         '26px',
          padding:              '18px',
          boxShadow:            '0 1px 0 oklch(100% 0.005 292 / 0.82) inset, 0 18px 46px -32px oklch(36% 0.045 292 / 0.5)',
          overflow:             'hidden',
        }}
      >
        {/* Radial glow overlay */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         '-50px -10% auto -10%',
            height:        '220px',
            background:    'radial-gradient(ellipse at 50% 50%, var(--glow-rose) 0%, transparent 65%), radial-gradient(ellipse at 30% 60%, var(--glow-violet) 0%, transparent 60%)',
            filter:        'blur(40px)',
            pointerEvents: 'none',
            zIndex:        0,
            borderRadius:  '50%',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Head */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              marginBottom:   '14px',
            }}
          >
            <span
              style={{
                fontSize:       '11px',
                fontWeight:     700,
                color:          'var(--rose-gold)',
                letterSpacing:  '0.14em',
                textTransform:  'uppercase',
              }}
            >
              תצוגה חיה
            </span>
            <span
              style={{
                fontSize:   '11px',
                color:      'var(--ink-mute)',
                fontFamily: "ui-monospace, 'SF Mono', monospace",
              }}
            >
              /{event.slug}
            </span>
          </div>

          {/* Mode tabs */}
          <div
            style={{
              display:      'flex',
              gap:          '4px',
              marginBottom: '14px',
              padding:      '3px',
              background:   'oklch(95% 0.02 292 / 0.58)',
              border:       '1px solid var(--glass-line)',
              borderRadius: 'var(--r-sm, 10px)',
            }}
          >
            {(['mobile', 'desktop'] as const).map(m => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    flex:          1,
                    padding:       '6px 8px',
                    fontSize:      '11.5px',
                    fontWeight:    700,
                    fontFamily:    'inherit',
                    color:         active ? 'var(--violet-700)' : 'var(--ink-soft)',
                    background:    active ? 'oklch(100% 0.006 292 / 0.82)' : 'transparent',
                    borderRadius:  'var(--r-xs, 6px)',
                    textAlign:     'center',
                    border:        'none',
                    cursor:        'pointer',
                    boxShadow:     active ? '0 8px 20px -16px oklch(36% 0.045 292 / 0.38), 0 1px 0 oklch(100% 0.005 292 / 0.68) inset' : 'none',
                    transition:    'background 200ms, color 200ms',
                  }}
                >
                  {m === 'mobile' ? 'סלולר' : 'שולחני'}
                </button>
              );
            })}
          </div>

          {/* Phone */}
          {phone}

          {/* Footer */}
          <div
            style={{
              marginTop:      '14px',
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              fontSize:       '11.5px',
              color:          'var(--ink-soft)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width:        '6px',
                  height:       '6px',
                  borderRadius: '50%',
                  background:   'var(--sage)',
                  animation:    'lp-pulse 1.6s infinite',
                }}
              />
              מתעדכן בזמן אמת
            </span>
            <span>{PHONE_W} × {PHONE_H}</span>
          </div>
        </div>
      </div>
    </>
  );
}

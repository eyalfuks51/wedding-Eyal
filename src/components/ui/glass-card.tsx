import { cn } from '@/lib/utils';

/**
 * GlassCard family — Liquid-glass card primitives.
 *
 * The glass surface properties (background, backdrop-filter, border) are
 * applied via INLINE STYLES on the root element. This bypasses the CSS
 * @layer cascade entirely — Tailwind utilities sit inside @layer utilities
 * but the project's global.scss is unlayered, meaning unlayered CSS always
 * wins over @layer styles regardless of specificity. Inline styles sit above
 * everything in the cascade, so this is the only reliable approach.
 *
 * Sub-components are explicitly bg-transparent so the parent glass shows
 * through without any opaque band interrupting the surface.
 */

const GLASS_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(40px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
  border: '1px solid rgba(255, 255, 255, 0.55)',
  boxShadow: [
    '0 8px 32px rgba(0, 0, 0, 0.14)',
    '0 2px 8px rgba(0, 0, 0, 0.08)',
    'inset 0 1px 0 rgba(255, 255, 255, 0.90)',
  ].join(', '),
};

function GlassCard({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        'flex flex-col rounded-2xl text-slate-900',
        className,
      )}
      style={{ ...GLASS_STYLE, ...style }}
      {...props}
    />
  );
}

function GlassCardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn(
        'flex items-center justify-between gap-2 px-6 py-4 bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

function GlassCardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  );
}

function GlassCardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-description"
      className={cn('text-sm text-slate-500', className)}
      {...props}
    />
  );
}

function GlassCardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-action"
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}

function GlassCardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn('px-6 bg-transparent', className)}
      {...props}
    />
  );
}

function GlassCardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn('flex items-center px-6 bg-transparent', className)}
      {...props}
    />
  );
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardAction,
  GlassCardContent,
  GlassCardFooter,
};

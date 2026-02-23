import { cn } from '@/lib/utils';

/**
 * GlassCard family — Liquid-glass card primitives.
 *
 * BACKGROUND TRANSPARENCY STRATEGY
 * ---------------------------------
 * global.scss is unlayered CSS. The CSS @layer spec says unlayered styles
 * always win over @layer styles, so every Tailwind bg-* class can be beaten
 * by the global * { } reset. To guarantee transparency on child elements we
 * force background: transparent via inline style on every sub-component.
 * Only the outer GlassCard shell carries the actual glass surface.
 */

function GlassCard({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        'border border-white/50 shadow-2xl',
        'flex flex-col rounded-2xl text-slate-900',
        className,
      )}
      style={{
        background: 'rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        ...style,
      }}
      {...props}
    />
  );
}

function GlassCardHeader({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn(
        'flex items-center justify-between gap-2 px-6 py-4',
        className,
      )}
      style={{ background: 'transparent', ...style }}
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

function GlassCardContent({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn('px-6', className)}
      style={{ background: 'transparent', ...style }}
      {...props}
    />
  );
}

function GlassCardFooter({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn('flex items-center px-6', className)}
      style={{ background: 'transparent', ...style }}
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

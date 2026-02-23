import { cn } from '@/lib/utils';

/**
 * GlassCard family — Liquid-glass card primitives.
 *
 * Visual recipe (light / wedding-appropriate):
 *   bg-white/40        — 40 % white: translucent enough to see the page
 *                        content bleed through the frosted surface
 *   backdrop-blur-2xl  — 40 px blur: heavy frosting effect
 *   border-white/50    — bright specular edge, not a hard grey line
 *   shadow-2xl         — deep drop shadow for elevation
 *   text-slate-900     — Hebrew labels stay dark and readable
 *
 * Sub-components must be bg-transparent so the parent glass surface
 * shows through without interruption.
 */

function GlassCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        'bg-white/40 backdrop-blur-2xl',
        'border border-white/50',
        'shadow-2xl',
        'flex flex-col rounded-2xl text-slate-900',
        className,
      )}
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

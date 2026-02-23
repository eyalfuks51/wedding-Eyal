import { cn } from '@/lib/utils';

/**
 * GlassCard family — Liquid-glass card primitives.
 *
 * Visual recipe (light / wedding-appropriate):
 *   • bg-white/55      — 55 % white so the dimmed backdrop bleeds through
 *   • backdrop-blur-xl — 24 px blur (same as CSS reference)
 *   • backdrop-saturate-[1.8] — amplifies violet/slate tones from the page
 *   • border-white/50  — bright edge specular, not a hard line
 *   • glass-panel      — inset top-edge highlight + layered outer shadow
 *                        (defined in @layer components in tailwind.css;
 *                         Tailwind arbitrary-value strings can't express
 *                         multi-value inset shadows reliably in JIT)
 *   • text-slate-900   — all Hebrew text stays dark and fully readable
 *
 * Sub-components:
 *   GlassCardHeader   — flex row: title on the right, action on the left (RTL)
 *   GlassCardTitle    — heading slot (pass id for aria-labelledby)
 *   GlassCardAction   — trailing-edge slot (close button, secondary CTA)
 *   GlassCardDescription — muted subtitle slot
 *   GlassCardContent  — scrollable body area
 *   GlassCardFooter   — bottom action tray
 */

function GlassCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        // Glass surface — Tailwind utilities override the legacy bg/blur
        // lines from .glass-panel because @layer utilities > @layer components
        'glass-panel',
        'bg-white/55 border-white/50',
        'flex flex-col rounded-2xl border text-slate-900',
        'backdrop-blur-xl backdrop-saturate-[1.8]',
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
        // Flex row — in RTL the title is on the right, action on the left
        'flex items-center justify-between gap-2 px-6 py-4',
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
      className={cn('px-6', className)}
      {...props}
    />
  );
}

function GlassCardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn('flex items-center px-6', className)}
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

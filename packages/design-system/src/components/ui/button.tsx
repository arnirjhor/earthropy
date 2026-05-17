'use client';

import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';

// Field Record button: Plex Mono labels, warm-paper token surfaces.
// No raw hex values — all colors reference theme.css custom properties.
const buttonVariants = cva(
  // Base: mono font for labels per Field Record spec (IBM Plex Mono, all-small-caps).
  // font-mono is Tailwind's utility that resolves to var(--font-mono) which is IBM Plex Mono.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-[length:var(--text-mono)] [font-variant-caps:all-small-caps] rounded-[var(--radius-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-text)] text-[var(--color-paper)] hover:bg-[var(--color-text-muted)]',
        destructive: 'bg-[var(--sdg-1)] text-[var(--color-surface)] hover:opacity-90',
        outline:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface)]',
        secondary:
          'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]',
        ghost: 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface)]',
        link: 'text-[var(--color-text)] underline-offset-4 hover:underline bg-transparent',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-[length:var(--text-micro)]',
        lg: 'h-11 px-6 text-[length:var(--text-body-sm)]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

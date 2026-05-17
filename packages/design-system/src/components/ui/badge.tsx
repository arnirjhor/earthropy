import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius-xs)] border border-[var(--color-border)] font-mono text-[length:var(--text-micro)] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-text)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-text)] text-[var(--color-paper)] px-2.5 py-0.5',
        secondary:
          'border-transparent bg-[var(--color-surface)] text-[var(--color-text)] px-2.5 py-0.5',
        destructive:
          'border-transparent bg-[var(--sdg-1)] text-[var(--color-surface)] px-2.5 py-0.5',
        outline: 'text-[var(--color-text)] px-2.5 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

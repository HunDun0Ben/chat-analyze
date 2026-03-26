import React from 'react';
import { cn } from '../../utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Card = ({ children, className, glass, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        'bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[var(--radius-card)] shadow-2xl relative overflow-hidden transition-colors duration-200',
        glass &&
          'bg-black/[0.02] dark:bg-white/[0.02] border-[var(--card-border)] backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-8 pt-8 pb-4', className)} {...props}>
    {children}
  </div>
);

export const CardContent = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-8 pb-8 pt-4', className)} {...props}>
    {children}
  </div>
);

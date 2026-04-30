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
  <div className={cn('p-6 pt-0', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props}>
    {children}
  </p>
);

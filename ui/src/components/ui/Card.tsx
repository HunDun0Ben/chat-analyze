/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Card Atomic Component
 */

import React from 'react';
import { cn } from '../../utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Card = ({ children, className, glass, ...props }: CardProps) => {
  return (
    <div 
      className={cn(
        "bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[2rem] shadow-2xl relative overflow-hidden",
        glass && "bg-white/[0.02] border-white/5 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-8 pt-8 pb-4", className)} {...props}>
    {children}
  </div>
);

export const CardContent = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-8 pb-8 pt-4", className)} {...props}>
    {children}
  </div>
);

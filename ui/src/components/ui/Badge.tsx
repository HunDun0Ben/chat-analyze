/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Badge Atomic Component
 */

import React from 'react';
import { cn } from '../../utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

export const Badge = ({ children, className, variant = 'primary', ...props }: BadgeProps) => {
  const variants = {
    primary: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    secondary: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    outline: "bg-transparent border-white/10 text-slate-400",
    ghost: "bg-white/5 border-transparent text-slate-500"
  };

  return (
    <span 
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

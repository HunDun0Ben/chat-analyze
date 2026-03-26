/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Progress Atomic Component
 */

import { cn } from '../../utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
}

export const Progress = ({ value, max = 100, className, indicatorClassName }: ProgressProps) => {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));
  
  return (
    <div className={cn("h-1.5 w-full bg-slate-800 rounded-full overflow-hidden", className)}>
      <div 
        className={cn("h-full transition-all duration-700 bg-blue-500", indicatorClassName)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

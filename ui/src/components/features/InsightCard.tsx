/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - InsightCard Component
 */

import React from 'react';

interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  desc: string;
}

export function InsightCard({ icon, title, value, desc }: InsightCardProps) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-3 hover:bg-white/[0.04] transition-colors group">
      <div className="flex items-center gap-3">
        <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">{icon}</div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-white truncate">{value}</div>
        <div className="text-[10px] text-slate-600 leading-tight mt-1">{desc}</div>
      </div>
    </div>
  );
}

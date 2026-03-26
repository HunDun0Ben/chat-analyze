


import React from 'react';

interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  desc: string;
}

export function InsightCard({ icon, title, value, desc }: InsightCardProps) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] p-6 rounded-2xl space-y-3 hover:bg-[var(--sidebar-hover)] transition-colors group relative overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors">{icon}</div>
        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{title}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-[var(--text-main)] truncate">{value}</div>
        <div className="text-[10px] text-[var(--text-dim)] leading-tight mt-1">{desc}</div>
      </div>
    </div>
  );
}

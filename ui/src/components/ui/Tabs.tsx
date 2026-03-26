


import React from 'react';
import { cn } from '../../utils';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  activeColor?: string; // Tailwind classes like "text-blue-400 border-blue-500 bg-blue-500/5"
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export const Tabs = ({ tabs, activeTab, onTabChange, className }: TabsProps) => {
  return (
    <div className={cn("flex border-b border-[var(--card-border)] h-12 shrink-0", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const activeClass = tab.activeColor || "text-amber-400 border-amber-500 bg-amber-500/5";
        
        return (
          <button 
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all",
              isActive 
                ? `${activeClass} border-b-2` 
                : "text-slate-600 hover:text-slate-400 hover:bg-white/5"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

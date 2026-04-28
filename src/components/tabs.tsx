'use client';

import { useState, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  content: ReactNode;
}

interface Props {
  tabs: TabItem[];
  defaultTabId?: string;
}

export function Tabs({ tabs, defaultTabId }: Props) {
  const [activeId, setActiveId] = useState<string>(defaultTabId ?? tabs[0]?.id ?? '');
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-1 border-b border-zinc-200">
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-panel-${tab.id}`}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <span className="inline-flex items-baseline gap-1.5">
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`font-mono text-[11px] tnum ${
                      isActive ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -bottom-px left-0 right-0 h-0.5 bg-emerald-700"
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`tab-panel-${active?.id}`}
        aria-labelledby={`tab-${active?.id}`}
      >
        {active?.content}
      </div>
    </div>
  );
}

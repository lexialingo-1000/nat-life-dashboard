'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  content: ReactNode;
}

interface Props {
  tabs: TabItem[];
  defaultTabId?: string;
  /** V12bis PR4 — sync l'ID actif avec ?tab=… dans l'URL. */
  syncWithSearchParams?: boolean;
}

export function Tabs({ tabs, defaultTabId, syncWithSearchParams = true }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialId = (() => {
    if (syncWithSearchParams) {
      const fromUrl = searchParams?.get('tab');
      if (fromUrl && tabs.some((t) => t.id === fromUrl)) return fromUrl;
    }
    return defaultTabId ?? tabs[0]?.id ?? '';
  })();

  const [activeId, setActiveId] = useState<string>(initialId);

  // Sync state ↔ URL bidirectionnel.
  useEffect(() => {
    if (!syncWithSearchParams) return;
    const fromUrl = searchParams?.get('tab');
    if (fromUrl && fromUrl !== activeId && tabs.some((t) => t.id === fromUrl)) {
      setActiveId(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onSelect = (id: string) => {
    setActiveId(id);
    if (syncWithSearchParams && pathname) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-zinc-200">
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
              onClick={() => onSelect(tab.id)}
              className={`relative shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
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
                  className="absolute -bottom-px left-0 right-0 h-0.5 bg-blue-700"
                />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`tab-panel-${active?.id}`} aria-labelledby={`tab-${active?.id}`}>
        {active?.content}
      </div>
    </div>
  );
}

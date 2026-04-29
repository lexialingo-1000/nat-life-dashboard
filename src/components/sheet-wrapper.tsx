'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';

export function SheetWrapper({
  children,
  fullPageHref,
}: {
  children: React.ReactNode;
  fullPageHref: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <aside className="hidden w-[480px] shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-[#fbf8f0] xl:flex">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-[#f5f1e8]/50 px-6 py-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Fiche
        </span>
        <div className="flex items-center gap-1">
          <a
            href={fullPageHref}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-zinc-500 transition-colors duration-150 ease-out-quart hover:bg-zinc-200/60 hover:text-zinc-900"
            aria-label="Ouvrir en pleine page"
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-zinc-500 transition-colors duration-150 ease-out-quart hover:bg-zinc-200/60 hover:text-zinc-900"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="flex-1 px-6 py-6">{children}</div>
    </aside>
  );
}

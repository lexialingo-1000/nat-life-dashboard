'use client';

import { useState } from 'react';
import { Columns3 } from 'lucide-react';

/**
 * dashboard-22 mobile — bouton « Colonnes » + popover de cases à cocher, partagé
 * entre `DataTable` (TanStack) et `TachesListTable` (table HTML custom).
 *
 * Présentation reprise telle quelle de l'ancien picker inline de `data-table.tsx`
 * pour garder un look identique partout. Le composant est « contrôlé » : l'état
 * de visibilité vit dans le parent (cf. `useColumnVisibility`).
 */
export interface PickerColumn {
  id: string;
  label: string;
  visible: boolean;
  toggle: () => void;
}

export function ColumnPickerButton({ columns }: { columns: PickerColumn[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
      >
        <Columns3 className="h-3.5 w-3.5" strokeWidth={1.5} />
        Colonnes
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-30 min-w-[180px] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Colonnes visibles
            </p>
            <div className="space-y-1.5">
              {columns.map((col) => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={col.toggle}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-blue-600"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Carte mobile (`sm:hidden`) : une ligne de tableau présentée verticalement.
 * `primary` = ligne d'identité toujours visible (titre + statut). `fields` =
 * couples label/valeur empilés, filtrés par leur drapeau `visible` (piloté par
 * la même map de visibilité que les colonnes desktop).
 */
export function MobileCard({
  primary,
  fields,
  actions,
}: {
  primary: React.ReactNode;
  fields: { label: string; value: React.ReactNode; visible: boolean }[];
  actions?: React.ReactNode;
}) {
  const visibleFields = fields.filter((f) => f.visible);
  return (
    <div className="card flex flex-col gap-1.5 p-3 sm:hidden">
      <div className="flex items-center justify-between gap-2">{primary}</div>
      {visibleFields.map((f) => (
        <div key={f.label} className="flex justify-between gap-3 text-[12px]">
          <span className="shrink-0 text-zinc-400">{f.label}</span>
          <span className="min-w-0 text-right text-zinc-700">{f.value}</span>
        </div>
      ))}
      {actions && (
        <div className="mt-1 flex items-center justify-end gap-1 border-t border-zinc-100 pt-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}

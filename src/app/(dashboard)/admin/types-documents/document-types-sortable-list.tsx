'use client';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { GripVertical, Clock, Pencil } from 'lucide-react';
import { reorderDocumentTypesAction, toggleActiveAction } from './actions';

const SCOPE_LABELS: Record<string, string> = {
  company: 'Société',
  supplier: 'Fournisseur',
  customer: 'Client',
  property: 'Immeuble',
  lot: 'Lot',
  marche: 'Marché',
  marche_lot: 'Sous-lot',
  location: 'Location',
};

const SCOPE_BADGE: Record<string, string> = {
  company: 'badge-emerald',
  supplier: 'badge-blue',
  customer: 'badge-emerald',
  property: 'badge-amber',
  lot: 'badge-amber',
  marche: 'badge-neutral',
  marche_lot: 'badge-neutral',
  location: 'badge-neutral',
};

const TENANT_LABELS: Record<string, string> = {
  LT: 'LT',
  CT: 'CT',
  all: 'Tous',
};

export interface DocTypeRow {
  id: string;
  scope: string;
  label: string;
  code: string;
  hasExpiration: boolean;
  isRequired: boolean;
  appliesToTenantType: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Props {
  rows: DocTypeRow[];
}

export function DocumentTypesSortableList({ rows }: Props) {
  const [items, setItems] = useState<DocTypeRow[]>(rows);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragIndex = useRef<number | null>(null);

  const handleDragStart = (i: number) => {
    dragIndex.current = i;
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOverIndex(i);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (targetIndex: number) => {
    setDragOverIndex(null);
    const src = dragIndex.current;
    if (src === null || src === targetIndex) return;

    const next = [...items];
    const [moved] = next.splice(src, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
    dragIndex.current = null;

    startTransition(async () => {
      await reorderDocumentTypesAction(next.map((r) => r.id));
    });
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragIndex.current = null;
  };

  return (
    <tbody className={isPending ? 'opacity-60' : ''}>
      {items.map((t, i) => (
        <tr
          key={t.id}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(i)}
          onDragEnd={handleDragEnd}
          className={`transition-colors ${dragOverIndex === i ? 'bg-emerald-50' : ''}`}
        >
          <td className="w-8 px-2">
            <GripVertical
              className="h-4 w-4 cursor-grab text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
              strokeWidth={1.75}
            />
          </td>
          <td>
            <span className={SCOPE_BADGE[t.scope] ?? 'badge-neutral'}>
              {SCOPE_LABELS[t.scope] ?? t.scope}
            </span>
          </td>
          <td className="font-medium text-zinc-900">{t.label}</td>
          <td className="font-mono text-[12px] text-zinc-500">{t.code}</td>
          <td>
            {t.hasExpiration ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-emerald-700">
                <Clock className="h-3 w-3" strokeWidth={2} />
                Avec date
              </span>
            ) : (
              <span className="text-[12px] text-zinc-400">—</span>
            )}
          </td>
          <td>
            {t.isRequired ? (
              <span className="badge-amber">Obligatoire</span>
            ) : (
              <span className="text-[12px] text-zinc-400">—</span>
            )}
          </td>
          <td>
            {t.scope === 'customer' && t.appliesToTenantType ? (
              <span className="badge-neutral">
                {TENANT_LABELS[t.appliesToTenantType] ?? t.appliesToTenantType}
              </span>
            ) : (
              <span className="text-[12px] text-zinc-400">—</span>
            )}
          </td>
          <td>
            {t.isActive ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Actif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-300" />
                Désactivé
              </span>
            )}
          </td>
          <td className="pr-5 text-right">
            <div className="inline-flex items-center gap-3">
              <Link
                href={`/admin/types-documents/${t.id}/edit`}
                className="inline-flex items-center gap-1 text-[12px] text-emerald-700 hover:text-emerald-800"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
                Modifier
              </Link>
              <form action={toggleActiveAction} className="inline-block">
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className="text-[12px] text-zinc-500 transition hover:text-emerald-700"
                >
                  {t.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
              </form>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

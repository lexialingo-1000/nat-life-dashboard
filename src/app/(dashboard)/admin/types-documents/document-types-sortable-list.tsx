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
  category: string | null;
  // V1.13 R1 — FK dynamique vers document_categories (source de vérité).
  categoryId?: string | null;
  hasExpiration: boolean;
  isRequired: boolean;
  appliesToTenantType: string | null;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  notaire: 'Notaire',
  banque: 'Banque',
  juridique: 'Juridique',
  comptabilite: 'Comptabilité',
  courant: 'Courant',
  location: 'Location',
};

const CATEGORY_BADGE: Record<string, string> = {
  notaire: 'badge-blue',
  banque: 'badge-emerald',
  juridique: 'badge-amber',
  comptabilite: 'badge-blue',
  courant: 'badge-neutral',
  location: 'badge-emerald',
};

interface Props {
  rows: DocTypeRow[];
  /** V1.13 R1 — map id → label depuis document_categories pour résoudre
   * dynamiquement le label affiché (au lieu de l'enum legacy hardcodé). */
  categoriesById?: Record<string, string>;
}

export function DocumentTypesSortableList({ rows, categoriesById }: Props) {
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
          className={`transition-colors ${dragOverIndex === i ? 'bg-blue-50' : ''}`}
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
          <td className="font-medium text-zinc-900">
            {t.label}
          </td>
          <td>
            {/* V1.13 R1 — priorité au label dynamique via categoryId (source de
                vérité, edit admin/document-categories propagé). Fallback sur
                l'enum legacy + labels hardcodés si pas de categoryId. */}
            {(() => {
              const dynamicLabel = t.categoryId ? categoriesById?.[t.categoryId] : undefined;
              if (dynamicLabel) {
                const badgeKey = t.category ?? '';
                return (
                  <span className={CATEGORY_BADGE[badgeKey] ?? 'badge-neutral'}>
                    {dynamicLabel}
                  </span>
                );
              }
              if (t.category) {
                return (
                  <span className={CATEGORY_BADGE[t.category] ?? 'badge-neutral'}>
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </span>
                );
              }
              return <span className="text-[12px] text-zinc-300">—</span>;
            })()}
          </td>
          <td>
            {t.hasExpiration ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-blue-700">
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
              <span className="inline-flex items-center gap-1.5 text-[12px] text-blue-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
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
                className="inline-flex items-center gap-1 text-[12px] text-blue-700 hover:text-blue-800"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
                Modifier
              </Link>
              <form action={toggleActiveAction} className="inline-block">
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className="text-[12px] text-zinc-500 transition hover:text-blue-700"
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

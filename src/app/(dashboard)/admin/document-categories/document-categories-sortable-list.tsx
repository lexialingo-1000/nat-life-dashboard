'use client';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { GripVertical, Pencil } from 'lucide-react';
import {
  reorderDocumentCategoriesAction,
  toggleDocumentCategoryActiveAction,
} from './actions';

export interface DocumentCategoryRow {
  id: string;
  label: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

interface Props {
  rows: DocumentCategoryRow[];
}

export function DocumentCategoriesSortableList({ rows }: Props) {
  const [items, setItems] = useState<DocumentCategoryRow[]>(rows);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragIndex = useRef<number | null>(null);

  const handleDragStart = (i: number) => { dragIndex.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIndex(i); };
  const handleDragLeave = () => setDragOverIndex(null);
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
      await reorderDocumentCategoriesAction(next.map((r) => r.id));
    });
  };
  const handleDragEnd = () => { setDragOverIndex(null); dragIndex.current = null; };

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
          <td className="font-medium text-zinc-900">{t.label}</td>
          <td className="font-mono text-[12px] text-zinc-500">{t.code}</td>
          <td>
            {t.isActive ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-blue-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-300" />
                Désactivée
              </span>
            )}
          </td>
          <td className="pr-5 text-right">
            <div className="inline-flex items-center gap-3">
              <Link
                href={`/admin/document-categories/${t.id}/edit`}
                className="inline-flex items-center gap-1 text-[12px] text-blue-700 hover:text-blue-800"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
                Modifier
              </Link>
              <form action={toggleDocumentCategoryActiveAction} className="inline-block">
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-[12px] text-zinc-500 transition hover:text-blue-700">
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

'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, Trash2 } from 'lucide-react';
import { deleteRoomAction, reorderRoomsAction } from '@/app/(dashboard)/biens/actions';

interface RoomItem {
  id: string;
  name: string;
  surfaceM2: string | null;
  sortOrder: number;
}

interface Props {
  rooms: RoomItem[];
  levelId: string;
  lotId: string;
}

export function RoomsSortableList({ rooms: initialRooms, levelId, lotId }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<RoomItem[]>(
    [...initialRooms].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragIndex = useRef<number | null>(null);

  // Sync local state when server returns updated rooms (after create / delete / reorder).
  // Compare by ID list signature so a no-op refresh doesn't fight optimistic ordering.
  useEffect(() => {
    const sorted = [...initialRooms].sort((a, b) => a.sortOrder - b.sortOrder);
    const sig = sorted.map((r) => r.id).join('|');
    const localSig = items.map((r) => r.id).join('|');
    if (sig !== localSig) setItems(sorted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRooms]);

  const handleDragStart = (i: number) => {
    dragIndex.current = i;
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOverIndex(i);
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
      await reorderRoomsAction(
        next.map((r) => r.id),
        lotId,
      );
    });
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragIndex.current = null;
  };

  if (items.length === 0) {
    return (
      <li className="px-4 py-3 text-[12px] text-zinc-400">Aucune pièce déclarée à ce niveau.</li>
    );
  }

  return (
    <>
      {items.map((r, i) => (
        <li
          key={r.id}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={() => handleDrop(i)}
          onDragEnd={handleDragEnd}
          className={`flex items-center justify-between px-4 py-2 text-[13px] transition-colors ${
            dragOverIndex === i ? 'bg-blue-50' : ''
          } ${isPending ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2">
            <GripVertical
              className="h-3.5 w-3.5 cursor-grab text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
              strokeWidth={1.75}
            />
            <span className="text-zinc-800">{r.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="tnum text-[12px] text-zinc-500">
              {r.surfaceM2 ? `${r.surfaceM2} m²` : '—'}
            </span>
            <button
              type="button"
              title="Supprimer cette pièce"
              onClick={async () => {
                if (!confirm(`Supprimer la pièce "${r.name}" ?`)) return;
                const fd = new FormData();
                fd.set('roomId', r.id);
                fd.set('lotId', lotId);
                try {
                  await deleteRoomAction(fd);
                  router.refresh();
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Erreur suppression');
                }
              }}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </li>
      ))}
    </>
  );
}

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteLevelAction } from '@/app/(dashboard)/biens/actions';

interface Props {
  levelId: string;
  lotId: string;
  levelName: string;
}

export function DeleteLevelButton({ levelId, lotId, levelName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Supprimer le niveau (et ses pièces)"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Supprimer le niveau "${levelName}" et toutes ses pièces ?`)) return;
        startTransition(async () => {
          try {
            const fd = new FormData();
            fd.set('levelId', levelId);
            fd.set('lotId', lotId);
            await deleteLevelAction(fd);
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : 'Erreur suppression');
          }
        });
      }}
      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}

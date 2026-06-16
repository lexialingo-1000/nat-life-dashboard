import { StickyNote } from 'lucide-react';

interface Props {
  notes: string | null | undefined;
}

/**
 * Carte Notes intégrée à la vue d'ensemble (V1.4 — l'onglet Notes séparé
 * est supprimé sur toutes les fiches d'entité).
 */
export function NotesCard({ notes }: Props) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        <StickyNote className="h-3.5 w-3.5" strokeWidth={1.75} />
        Notes
      </h2>
      {notes ? (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">{notes}</p>
      ) : (
        <p className="text-[13px] italic text-zinc-400">Aucune note pour le moment.</p>
      )}
    </div>
  );
}

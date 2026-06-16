'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { updateTacheStatusAction } from '@/app/(dashboard)/marches/actions';

// V1.13 R5 — 'en_attente' ajouté en tête (Remarques client dashboard-17).
const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
  valide: 'Validé',
};

const STATUS_BADGE: Record<string, string> = {
  en_attente: 'bg-amber-50 text-amber-800 border-amber-300',
  a_faire: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  en_cours: 'bg-blue-100 text-blue-700 border-blue-300',
  termine: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  valide: 'bg-emerald-200 text-emerald-900 border-emerald-400',
};

interface Props {
  tacheId: string;
  currentStatus: string;
}

/**
 * Inline status dropdown — submit `updateTacheStatusAction` via useTransition.
 * Source : Remarques client dashboard-8.docx §12 ("l'admin doit pouvoir changer
 * directement le statut" depuis la liste).
 */
export function TacheStatusSelect({ tacheId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;
    const formData = new FormData();
    formData.set('id', tacheId);
    formData.set('status', newStatus);
    startTransition(async () => {
      await updateTacheStatusAction(formData);
    });
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className={`rounded-sm border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${
          STATUS_BADGE[currentStatus] ?? STATUS_BADGE.a_faire
        }`}
      >
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
    </div>
  );
}

import Link from 'next/link';
import { Calendar, MapPin, Pencil } from 'lucide-react';
import { TacheStatusSelect } from '@/components/tache-status-select';

/**
 * V1.13 R6 — Tableau "Suivi des tâches" pour la fiche fournisseur.
 * Source : Remarques client dashboard-17 §"Fiche FOURNISSEUR" — "Rajouter un
 * onglet reprenant la liste des taches pour tous les marchés de travaux du
 * fournisseur".
 *
 * Server component (zéro state) — le dropdown statut est un client component
 * dédié (<TacheStatusSelect>). Pas de delete inline pour éviter de dupliquer
 * la logique d'invalidation : edit redirige vers la fiche tâche.
 */

export interface SupplierTacheRow {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  marcheId: string;
  marcheName: string;
  sousLotId: string;
  sousLotName: string;
  roomName: string | null;
  levelName: string | null;
}

interface Props {
  rows: SupplierTacheRow[];
  /** URL de retour pour l'edit (revient sur l'onglet Suivi du fournisseur). */
  returnTo: string;
}

function formatDateFr(value: string | null): string | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN((d as Date).getTime())) return null;
  return (d as Date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function SupplierTachesTable({ rows, returnTo }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-zinc-500">
        Aucune tâche sur les marchés de ce fournisseur.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="border-b border-zinc-100 bg-[#fbf8f0]/60 text-left text-[11px] uppercase tracking-[0.04em] text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Marché</th>
            <th className="px-3 py-2 font-medium">Sous-lot</th>
            <th className="px-3 py-2 font-medium">Tâche</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Niveau / Pièce</th>
            <th className="px-3 py-2 font-medium">Échéance</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((t) => {
            const location = [t.levelName, t.roomName].filter(Boolean).join(' · ');
            return (
              <tr key={t.id} className="hover:bg-[#fbf8f0]/40">
                <td className="px-3 py-2">
                  <Link
                    href={`/marches/${t.marcheId}?tab=suivi`}
                    className="text-blue-700 hover:underline"
                  >
                    {t.marcheName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600">{t.sousLotName}</td>
                <td className="px-3 py-2 font-medium text-zinc-900">{t.title}</td>
                <td className="px-3 py-2">
                  <TacheStatusSelect tacheId={t.id} currentStatus={t.status} />
                </td>
                <td className="px-3 py-2 text-zinc-600">
                  {location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" strokeWidth={1.75} />
                      {location}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-zinc-600">
                  {t.dueDate ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" strokeWidth={1.75} />
                      {formatDateFr(t.dueDate)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/marches/${t.marcheId}/sous-lots/${t.sousLotId}/taches/${t.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                    title="Modifier la tâche"
                    aria-label="Modifier la tâche"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import Link from 'next/link';
import { ChevronRight, Plus, Camera, MapPin, User } from 'lucide-react';
import { TacheStatusSelect } from './tache-status-select';

/**
 * Vue cascade Marché > Sous-lot > Tâches dépliable, pattern `<details>` HTML
 * natif (zéro JS) — analogue à `property-structure-tree.tsx` (V1.4.5 L5).
 *
 * Sources :
 * - Remarques client dashboard-8.docx §8 (visualisation cascade)
 * - dashboard-8.docx §9-12 (tâches avec Statut/Titre/Emplacement/Contact/Photos)
 *
 * Server component pur — aucune state interactive (status select = client component).
 */

const MARCHE_STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

const MARCHE_STATUS_BADGE: Record<string, string> = {
  devis_recu: 'bg-zinc-100 text-zinc-700',
  signe: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-amber-100 text-amber-700',
  livre: 'bg-emerald-100 text-emerald-700',
  conteste: 'bg-red-100 text-red-700',
  annule: 'bg-zinc-200 text-zinc-500',
};

export interface TacheNode {
  id: string;
  title: string;
  status: string;
  locationDescription: string | null;
  supplierContactName: string | null;
  photosCount: number;
  lotId: string;
}

export interface SousLotNode {
  id: string;
  name: string;
  status: string;
  marcheTypeLabel: string | null;
  taches: TacheNode[];
}

export interface MarcheNode {
  id: string;
  supplierName: string;
  status: string;
  amountHt: string | null;
  sousLots: SousLotNode[];
}

interface Props {
  marches: MarcheNode[];
  /** URL de retour pour les links create/edit tâche */
  returnTo: string;
}

export function MarchesTree({ marches, returnTo }: Props) {
  if (marches.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-zinc-500">
        Aucun marché de travaux sur ce bien.{' '}
        <Link href="/marches/new" className="text-blue-600 hover:underline">
          Créer un marché
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {marches.map((m) => (
        <MarcheBranch key={m.id} marche={m} returnTo={returnTo} />
      ))}
    </div>
  );
}

function MarcheBranch({ marche, returnTo }: { marche: MarcheNode; returnTo: string }) {
  const totalTaches = marche.sousLots.reduce((acc, sl) => acc + sl.taches.length, 0);
  const totalSousLots = marche.sousLots.length;

  return (
    <details open className="card overflow-hidden">
      <summary className="group flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-[#fbf8f0]">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-90" />
          <Link
            href={`/marches/${marche.id}`}
            className="font-medium uppercase tracking-[0.04em] text-zinc-900 hover:text-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            {marche.supplierName}
          </Link>
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${
              MARCHE_STATUS_BADGE[marche.status] ?? MARCHE_STATUS_BADGE.devis_recu
            }`}
          >
            {MARCHE_STATUS_LABELS[marche.status] ?? marche.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-zinc-500">
          {marche.amountHt && (
            <span className="tabular-nums">
              {Number(marche.amountHt).toLocaleString('fr-FR')} € HT
            </span>
          )}
          <span>
            {totalSousLots} sous-lot{totalSousLots > 1 ? 's' : ''} · {totalTaches} tâche
            {totalTaches !== 1 ? 's' : ''}
          </span>
        </div>
      </summary>
      <div className="border-t border-zinc-100 bg-[#fbf8f0]/40 px-4 py-3">
        {marche.sousLots.length === 0 ? (
          <p className="text-[13px] text-zinc-500">Aucun sous-lot.</p>
        ) : (
          <div className="space-y-2">
            {marche.sousLots.map((sl) => (
              <SousLotBranch
                key={sl.id}
                sousLot={sl}
                marcheId={marche.id}
                returnTo={returnTo}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function SousLotBranch({
  sousLot,
  marcheId,
  returnTo,
}: {
  sousLot: SousLotNode;
  marcheId: string;
  returnTo: string;
}) {
  return (
    <details open className="rounded-md border border-zinc-200 bg-white">
      <summary className="group flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-zinc-50">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 transition-transform group-open:rotate-90" />
          <span className="text-[13px] font-medium text-zinc-900">{sousLot.name}</span>
          {sousLot.marcheTypeLabel && (
            <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.04em] text-zinc-600">
              {sousLot.marcheTypeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span>
            {sousLot.taches.length} tâche{sousLot.taches.length !== 1 ? 's' : ''}
          </span>
          <Link
            href={`/marches/${marcheId}/sous-lots/${sousLot.id}/taches/new?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="h-3 w-3" strokeWidth={2} /> Ajouter
          </Link>
        </div>
      </summary>
      <div className="border-t border-zinc-100">
        {sousLot.taches.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-zinc-400">Aucune tâche.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {sousLot.taches.map((t) => (
              <TacheRow key={t.id} tache={t} returnTo={returnTo} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function TacheRow({ tache, returnTo }: { tache: TacheNode; returnTo: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] hover:bg-[#fbf8f0]/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <TacheStatusSelect tacheId={tache.id} currentStatus={tache.status} />
        <span className="truncate font-medium text-zinc-900">{tache.title}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
        {tache.locationDescription && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            <span className="max-w-[180px] truncate">{tache.locationDescription}</span>
          </span>
        )}
        {tache.supplierContactName && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" strokeWidth={1.75} />
            {tache.supplierContactName}
          </span>
        )}
        {tache.photosCount > 0 && (
          <span className="inline-flex items-center gap-1 text-blue-700">
            <Camera className="h-3 w-3" strokeWidth={1.75} />
            {tache.photosCount}
          </span>
        )}
      </div>
    </li>
  );
}

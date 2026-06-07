'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus, Camera, MapPin, User, Trash2, Pencil, Calendar } from 'lucide-react';
import { TacheStatusSelect } from './tache-status-select';
import { TachePhotosDialog } from './tache-photos-dialog';
import { deleteSousLotAction, deleteTacheAction } from '@/app/(dashboard)/marches/actions';

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
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

const MARCHE_STATUS_BADGE: Record<string, string> = {
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
  // V1.13 R3 — échéance + pièce + niveau visibles sur la liste tâches (Remarques dashboard-17).
  dueDate: string | null;
  roomName: string | null;
  levelName: string | null;
  supplierContactName: string | null;
  photosCount: number;
  // V1.x dashboard-21 §2 — clés MinIO des photos, pour la caméra cliquable.
  photos: string[];
  lotId: string;
}

// V1.13 R3 — formatage date FR sans dépendance (cohérent avec le reste de l'app
// qui utilise toLocaleString partout).
function formatDateFr(value: string | null): string | null {
  if (!value) return null;
  // marcheTaches.dueDate est une date Postgres → string "YYYY-MM-DD" ou Date.
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN((d as Date).getTime())) return null;
  return (d as Date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
  // V1.x dashboard-21 §2 — caméra cliquable par tâche (comme TachesListTable).
  const [photosTache, setPhotosTache] = useState<TacheNode | null>(null);

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
        <MarcheBranch key={m.id} marche={m} returnTo={returnTo} onOpenPhotos={setPhotosTache} />
      ))}
      {photosTache && (
        <TachePhotosDialog
          tacheId={photosTache.id}
          tacheTitle={photosTache.title}
          photos={photosTache.photos}
          onClose={() => setPhotosTache(null)}
        />
      )}
    </div>
  );
}

function MarcheBranch({
  marche,
  returnTo,
  onOpenPhotos,
}: {
  marche: MarcheNode;
  returnTo: string;
  onOpenPhotos: (t: TacheNode) => void;
}) {
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
              MARCHE_STATUS_BADGE[marche.status] ?? MARCHE_STATUS_BADGE.signe
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
                onOpenPhotos={onOpenPhotos}
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
  onOpenPhotos,
}: {
  sousLot: SousLotNode;
  marcheId: string;
  returnTo: string;
  onOpenPhotos: (t: TacheNode) => void;
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
          {/* V12bis PR9 §6 — modifier le sous-lot. */}
          <Link
            href={`/marches/${marcheId}/sous-lots/${sousLot.id}/edit`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={(e) => e.stopPropagation()}
            title="Modifier le sous-lot"
            aria-label="Modifier le sous-lot"
          >
            <Pencil className="h-3 w-3" strokeWidth={2} />
          </Link>
          <DeleteSousLotButton id={sousLot.id} name={sousLot.name} marcheId={marcheId} />
        </div>
      </summary>
      <div className="border-t border-zinc-100">
        {sousLot.taches.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-zinc-400">Aucune tâche.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {sousLot.taches.map((t) => (
              <TacheRow
                key={t.id}
                tache={t}
                marcheId={marcheId}
                sousLotId={sousLot.id}
                returnTo={returnTo}
                onOpenPhotos={onOpenPhotos}
              />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function TacheRow({
  tache,
  marcheId,
  sousLotId,
  returnTo,
  onOpenPhotos,
}: {
  tache: TacheNode;
  marcheId: string;
  sousLotId: string;
  returnTo: string;
  onOpenPhotos: (t: TacheNode) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] hover:bg-[#fbf8f0]/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <TacheStatusSelect tacheId={tache.id} currentStatus={tache.status} />
        <span className="truncate font-medium text-zinc-900">{tache.title}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
        {/* V1.13 R3 — Pièce / Niveau (depuis JOIN rooms→levels) ; fallback sur locationDescription legacy. */}
        {tache.roomName || tache.levelName ? (
          <span className="inline-flex items-center gap-1" title="Pièce / Niveau">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            <span className="max-w-[180px] truncate">
              {[tache.levelName, tache.roomName].filter(Boolean).join(' · ')}
            </span>
          </span>
        ) : tache.locationDescription ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            <span className="max-w-[180px] truncate">{tache.locationDescription}</span>
          </span>
        ) : null}
        {/* V1.13 R3 — Échéance. */}
        {tache.dueDate && (
          <span className="inline-flex items-center gap-1 tabular-nums" title="Échéance">
            <Calendar className="h-3 w-3" strokeWidth={1.75} />
            {formatDateFr(tache.dueDate)}
          </span>
        )}
        {tache.supplierContactName && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" strokeWidth={1.75} />
            {tache.supplierContactName}
          </span>
        )}
        {/* V1.x dashboard-21 §2 — caméra cliquable (voir/ajouter photos), comme
            le tableau du bas. Toujours visible, même sans photo. */}
        <button
          type="button"
          onClick={() => onOpenPhotos(tache)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-blue-700 hover:bg-blue-50"
          title="Voir / ajouter des photos"
        >
          <Camera className="h-3 w-3" strokeWidth={1.75} />
          {tache.photos.length > 0 && <span className="tabular-nums">{tache.photos.length}</span>}
        </button>
        {/* V12bis PR9 §6 — modifier la tâche. */}
        <Link
          href={`/marches/${marcheId}/sous-lots/${sousLotId}/taches/${tache.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          title="Modifier la tâche"
          aria-label="Modifier la tâche"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
        </Link>
        <DeleteTacheButton id={tache.id} title={tache.title} />
      </div>
    </li>
  );
}

// V12bis PR4 J1 — boutons de suppression inline sur sous-lot + tâche.

function DeleteSousLotButton({
  id,
  name,
  marcheId,
}: {
  id: string;
  name: string;
  marcheId: string;
}) {
  const [pending, startTransition] = useTransition();
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        `Supprimer le sous-lot "${name}" ? Cette action supprime aussi toutes ses tâches associées.`,
      )
    )
      return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      fd.set('marcheId', marcheId);
      await deleteSousLotAction(fd);
    });
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title="Supprimer ce sous-lot"
      className="rounded p-0.5 text-zinc-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="h-3 w-3" strokeWidth={1.75} />
    </button>
  );
}

function DeleteTacheButton({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer la tâche "${title}" ?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await deleteTacheAction(fd);
    });
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title="Supprimer cette tâche"
      className="rounded p-0.5 text-zinc-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="h-3 w-3" strokeWidth={1.75} />
    </button>
  );
}

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Camera, Pencil } from 'lucide-react';
import { TacheStatusSelect } from './tache-status-select';
import { TachePhotosDialog } from './tache-photos-dialog';
import { useState } from 'react';
import type { TacheListRow } from './taches-list-table';

/**
 * V22 dashboard-22 §"SUIVI DE TRAVAUX / FICHE BIEN" — Vue suivi de travaux groupée
 * par Marché (fournisseur) → Sous-lot → Tâches.
 * Même organisation que la fiche marché de travaux (MarchesTree),
 * mais filtré sur les tâches du lot courant.
 * Utilisé sur : /biens/lots/[id] onglet suivi-travaux.
 */

function formatDateFr(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Props {
  rows: TacheListRow[];
  returnTo: string;
}

export function TachesGroupedByMarche({ rows, returnTo }: Props) {
  const [photosTache, setPhotosTache] = useState<TacheListRow | null>(null);

  const grouped = useMemo(() => {
    const marchesMap = new Map<
      string,
      {
        marcheId: string;
        marcheName: string;
        sousLots: Map<string, { sousLotId: string; sousLotName: string; taches: TacheListRow[] }>;
      }
    >();

    for (const t of rows) {
      if (!marchesMap.has(t.marcheId)) {
        marchesMap.set(t.marcheId, {
          marcheId: t.marcheId,
          marcheName: t.marcheName,
          sousLots: new Map(),
        });
      }
      const m = marchesMap.get(t.marcheId)!;
      if (!m.sousLots.has(t.sousLotId)) {
        m.sousLots.set(t.sousLotId, {
          sousLotId: t.sousLotId,
          sousLotName: t.sousLotName,
          taches: [],
        });
      }
      m.sousLots.get(t.sousLotId)!.taches.push(t);
    }

    return Array.from(marchesMap.values()).map((m) => ({
      ...m,
      sousLots: Array.from(m.sousLots.values()),
    }));
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 px-4 py-8 text-center text-[13px] text-zinc-500">
        Aucune tâche de suivi sur ce lot.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {grouped.map((marche) => (
          <details key={marche.marcheId} open className="group rounded-lg border border-zinc-200">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-t-lg bg-zinc-50 px-4 py-2.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-100">
              <span className="mr-auto">{marche.marcheName}</span>
              <Link
                href={`/marches/${marche.marcheId}?tab=suivi`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-normal text-blue-700 hover:underline"
              >
                Voir marché
              </Link>
              <span className="text-[11px] font-normal text-zinc-500">
                {marche.sousLots.reduce((acc, s) => acc + s.taches.length, 0)} tâche
                {marche.sousLots.reduce((acc, s) => acc + s.taches.length, 0) > 1 ? 's' : ''}
              </span>
            </summary>

            <div className="divide-y divide-zinc-100">
              {marche.sousLots.map((sousLot) => (
                <div key={sousLot.sousLotId} className="px-4 py-2">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {sousLot.sousLotName}
                  </p>
                  <div className="space-y-1.5">
                    {sousLot.taches.map((t) => {
                      const emplacement = [t.levelName, t.roomName, t.locationDescription]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-1.5 hover:bg-zinc-50"
                        >
                          <TacheStatusSelect tacheId={t.id} currentStatus={t.status} />
                          <span className="min-w-0 flex-1 text-[13px] text-zinc-800">
                            {t.title}
                          </span>
                          {emplacement && (
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                              {emplacement}
                            </span>
                          )}
                          {t.dueDate && (
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              <Calendar className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                              {formatDateFr(t.dueDate)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPhotosTache(t)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-blue-700 hover:bg-blue-50"
                            title="Voir / ajouter des photos"
                          >
                            <Camera className="h-3 w-3" strokeWidth={1.75} />
                            {t.photos.length > 0 && (
                              <span className="tabular-nums">{t.photos.length}</span>
                            )}
                          </button>
                          <Link
                            href={`/marches/${t.marcheId}/sous-lots/${t.sousLotId}/taches/${t.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                            title="Modifier la tâche"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={2} />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {photosTache && (
        <TachePhotosDialog
          tacheId={photosTache.id}
          tacheTitle={photosTache.title}
          photos={photosTache.photos}
          onClose={() => setPhotosTache(null)}
        />
      )}
    </>
  );
}

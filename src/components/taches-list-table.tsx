'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Pencil,
  Camera,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
} from 'lucide-react';
import { TacheStatusSelect } from './tache-status-select';
import { TachePhotosDialog } from './tache-photos-dialog';

/**
 * V1.14 M-1 + F-1 + F-2 — Liste de tâches filtrable, triable, avec rupture
 * optionnelle par lot immo.
 *
 * Sources :
 * - Remarques client dashboard-18 §"LISTE DES TACHES DANS MARCHE DE TRAVAUX" :
 *   Emplacement + Échéance filtrables et triables.
 * - dashboard-18 §"LISTE DE SUIVI DE TACHES DANS FOURNISSEURS" :
 *   filtres sur toutes les colonnes + rupture par LOT (artisan tâches sur X lots).
 *
 * Utilisé sur :
 * - /fournisseurs/[id] onglet Suivi tâches (groupByLot=true par défaut)
 * - /marches/[id] onglet Suivi (vue liste plate complémentaire au MarchesTree)
 */

export interface TacheListRow {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  // Marché parent
  marcheId: string;
  marcheName: string;
  // Sous-lot parent
  sousLotId: string;
  sousLotName: string;
  // Lot immo (pour rupture par LOT, F-2)
  lotId: string;
  lotName: string;
  propertyId: string;
  propertyName: string;
  // Emplacement (Pièce / Niveau)
  roomName: string | null;
  levelName: string | null;
  locationDescription: string | null;
  // Photos (F-3)
  photos: string[];
}

interface Props {
  rows: TacheListRow[];
  returnTo: string;
  /** Active la rupture visuelle par lot immo (F-2). Default false. */
  groupByLot?: boolean;
  /** Masque les colonnes Bien/Lot quand on est déjà dans le contexte d'un marché unique. */
  hideLotColumn?: boolean;
}

type SortKey =
  | 'marche'
  | 'sousLot'
  | 'title'
  | 'status'
  | 'lot'
  | 'emplacement'
  | 'dueDate';
type SortDir = 'asc' | 'desc';

function formatDateFr(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const STATUS_FILTER_OPTIONS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'a_faire', label: 'À faire' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'valide', label: 'Validé' },
];
const ALL_STATUS_VALUES = STATUS_FILTER_OPTIONS.map((o) => o.value);
// V20 §FICHE LOT §5 — par défaut on masque les tâches terminées (toutes les
// autres cases cochées). Système de cases à cocher pour la colonne statut.
const DEFAULT_VISIBLE_STATUS = ALL_STATUS_VALUES.filter((v) => v !== 'termine');

export function TachesListTable({
  rows,
  returnTo,
  groupByLot = false,
  hideLotColumn = false,
}: Props) {
  const [filters, setFilters] = useState({
    marche: '',
    sousLot: '',
    title: '',
    lot: '',
    emplacement: '',
    dueDate: '',
  });
  // V20 §5 — filtre statut multi (cases à cocher). Défaut : tout sauf "Terminé".
  const [statusSet, setStatusSet] = useState<Set<string>>(
    () => new Set(DEFAULT_VISIBLE_STATUS)
  );
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'dueDate',
    dir: 'asc',
  });
  const [photosTache, setPhotosTache] = useState<TacheListRow | null>(null);

  const filtered = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().trim();
    return rows.filter((r) => {
      if (filters.marche && !norm(r.marcheName).includes(norm(filters.marche))) return false;
      if (filters.sousLot && !norm(r.sousLotName).includes(norm(filters.sousLot))) return false;
      if (filters.title && !norm(r.title).includes(norm(filters.title))) return false;
      if (!statusSet.has(r.status)) return false;
      if (filters.lot) {
        const lotLabel = `${r.propertyName} ${r.lotName}`;
        if (!norm(lotLabel).includes(norm(filters.lot))) return false;
      }
      if (filters.emplacement) {
        const empLabel = [r.levelName, r.roomName, r.locationDescription]
          .filter(Boolean)
          .join(' ');
        if (!norm(empLabel).includes(norm(filters.emplacement))) return false;
      }
      if (filters.dueDate) {
        if (!r.dueDate) return false;
        if (!r.dueDate.startsWith(filters.dueDate)) return false;
      }
      return true;
    });
  }, [rows, filters, statusSet]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: string;
      let bv: string;
      switch (sort.key) {
        case 'marche':
          av = a.marcheName;
          bv = b.marcheName;
          break;
        case 'sousLot':
          av = a.sousLotName;
          bv = b.sousLotName;
          break;
        case 'title':
          av = a.title;
          bv = b.title;
          break;
        case 'status':
          av = a.status;
          bv = b.status;
          break;
        case 'lot':
          av = `${a.propertyName} ${a.lotName}`;
          bv = `${b.propertyName} ${b.lotName}`;
          break;
        case 'emplacement':
          av = [a.levelName, a.roomName, a.locationDescription].filter(Boolean).join(' ');
          bv = [b.levelName, b.roomName, b.locationDescription].filter(Boolean).join(' ');
          break;
        case 'dueDate':
          av = a.dueDate ?? '￿'; // null en dernier en asc
          bv = b.dueDate ?? '￿';
          break;
      }
      return av.localeCompare(bv, 'fr', { sensitivity: 'base' }) * dir;
    });
    return arr;
  }, [filtered, sort]);

  // F-2 — rupture par LOT immo : on regroupe les rows triées par lotId, en
  // gardant l'ordre du tri courant à l'intérieur de chaque groupe.
  const groups = useMemo(() => {
    if (!groupByLot) return [{ key: '__all__', label: '', rows: sorted }];
    const map = new Map<string, { label: string; rows: TacheListRow[] }>();
    for (const r of sorted) {
      const key = r.lotId;
      const label = `${r.propertyName} · ${r.lotName}`;
      const g = map.get(key) ?? { label, rows: [] };
      g.rows.push(r);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([key, g]) => ({ key, label: g.label, rows: g.rows }));
  }, [sorted, groupByLot]);

  const toggleSort = (key: SortKey) => {
    setSort((cur) => {
      if (cur.key === key) {
        return { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  };

  const clearFilters = () => {
    setFilters({
      marche: '',
      sousLot: '',
      title: '',
      lot: '',
      emplacement: '',
      dueDate: '',
    });
    // Réinitialise au défaut métier : tout sauf "Terminé".
    setStatusSet(new Set(DEFAULT_VISIBLE_STATUS));
  };

  const toggleStatus = (value: string) => {
    setStatusSet((cur) => {
      const next = new Set(cur);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const statusFilterActive = statusSet.size !== ALL_STATUS_VALUES.length;
  const hasActiveFilters =
    Object.values(filters).some((v) => v !== '') || statusFilterActive;

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-zinc-500">
        Aucune tâche.
      </div>
    );
  }

  const colCount = (hideLotColumn ? 6 : 7) + 2; // +photos +edit

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-[#fbf8f0]/60 px-3 py-2 text-[12px] text-zinc-600">
        <div className="inline-flex items-center gap-2">
          <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>
            {sorted.length} tâche{sorted.length !== 1 ? 's' : ''}
            {hasActiveFilters && ` (filtré sur ${rows.length})`}
          </span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800"
          >
            <X className="h-3 w-3" strokeWidth={2} />
            Effacer les filtres
          </button>
        )}
      </div>

      <table className="w-full text-[13px]">
        <thead className="border-b border-zinc-100 bg-[#fbf8f0]/40 text-left text-[11px] uppercase tracking-[0.04em] text-zinc-500">
          <tr>
            <Th sortKey="marche" sort={sort} onSort={toggleSort}>
              Marché
            </Th>
            <Th sortKey="sousLot" sort={sort} onSort={toggleSort}>
              Sous-lot
            </Th>
            <Th sortKey="title" sort={sort} onSort={toggleSort}>
              Tâche
            </Th>
            <Th sortKey="status" sort={sort} onSort={toggleSort}>
              Statut
            </Th>
            {!hideLotColumn && (
              <Th sortKey="lot" sort={sort} onSort={toggleSort}>
                Bien · Lot
              </Th>
            )}
            <Th sortKey="emplacement" sort={sort} onSort={toggleSort}>
              Emplacement
            </Th>
            <Th sortKey="dueDate" sort={sort} onSort={toggleSort}>
              Échéance
            </Th>
            <th className="px-3 py-2 font-medium">Photos</th>
            <th className="px-3 py-2"></th>
          </tr>
          <tr className="bg-white">
            <FilterTh>
              <input
                type="text"
                value={filters.marche}
                onChange={(e) => setFilters((f) => ({ ...f, marche: e.target.value }))}
                placeholder="Filtrer…"
                className="filter-input"
              />
            </FilterTh>
            <FilterTh>
              <input
                type="text"
                value={filters.sousLot}
                onChange={(e) => setFilters((f) => ({ ...f, sousLot: e.target.value }))}
                placeholder="Filtrer…"
                className="filter-input"
              />
            </FilterTh>
            <FilterTh>
              <input
                type="text"
                value={filters.title}
                onChange={(e) => setFilters((f) => ({ ...f, title: e.target.value }))}
                placeholder="Filtrer…"
                className="filter-input"
              />
            </FilterTh>
            <FilterTh>
              <details className="status-filter">
                <summary className="filter-input status-filter-summary">
                  {statusSet.size === ALL_STATUS_VALUES.length
                    ? 'Tous'
                    : statusSet.size === 0
                      ? 'Aucun'
                      : `${statusSet.size} statut${statusSet.size > 1 ? 's' : ''}`}
                </summary>
                <div className="status-filter-panel">
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <label key={o.value} className="status-filter-option">
                      <input
                        type="checkbox"
                        checked={statusSet.has(o.value)}
                        onChange={() => toggleStatus(o.value)}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                  <div className="status-filter-actions">
                    <button
                      type="button"
                      onClick={() => setStatusSet(new Set(ALL_STATUS_VALUES))}
                    >
                      Tout
                    </button>
                    <button type="button" onClick={() => setStatusSet(new Set())}>
                      Aucun
                    </button>
                  </div>
                </div>
              </details>
            </FilterTh>
            {!hideLotColumn && (
              <FilterTh>
                <input
                  type="text"
                  value={filters.lot}
                  onChange={(e) => setFilters((f) => ({ ...f, lot: e.target.value }))}
                  placeholder="Filtrer…"
                  className="filter-input"
                />
              </FilterTh>
            )}
            <FilterTh>
              <input
                type="text"
                value={filters.emplacement}
                onChange={(e) => setFilters((f) => ({ ...f, emplacement: e.target.value }))}
                placeholder="Filtrer…"
                className="filter-input"
              />
            </FilterTh>
            <FilterTh>
              <input
                type="month"
                value={filters.dueDate}
                onChange={(e) => setFilters((f) => ({ ...f, dueDate: e.target.value }))}
                className="filter-input"
              />
            </FilterTh>
            <FilterTh></FilterTh>
            <FilterTh></FilterTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className="px-3 py-8 text-center text-sm text-zinc-500"
              >
                Aucune tâche ne correspond aux filtres.
              </td>
            </tr>
          ) : (
            groups.map((g) => (
              <GroupBlock
                key={g.key}
                label={g.label}
                rows={g.rows}
                returnTo={returnTo}
                hideLotColumn={hideLotColumn}
                colCount={colCount}
                onOpenPhotos={(t) => setPhotosTache(t)}
              />
            ))
          )}
        </tbody>
      </table>

      <style jsx>{`
        :global(.filter-input) {
          width: 100%;
          font-size: 12px;
          padding: 4px 6px;
          border: 1px solid rgb(228 228 231);
          border-radius: 4px;
          background: white;
        }
        :global(.filter-input:focus) {
          outline: 2px solid rgb(96 165 250);
          outline-offset: -1px;
        }
        .status-filter {
          position: relative;
        }
        .status-filter-summary {
          cursor: pointer;
          list-style: none;
          user-select: none;
          white-space: nowrap;
        }
        .status-filter-summary::-webkit-details-marker {
          display: none;
        }
        .status-filter-panel {
          position: absolute;
          z-index: 20;
          margin-top: 4px;
          min-width: 160px;
          background: white;
          border: 1px solid rgb(228 228 231);
          border-radius: 6px;
          box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
          padding: 6px;
        }
        .status-filter-option {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 6px;
          font-size: 12px;
          font-weight: 400;
          text-transform: none;
          letter-spacing: normal;
          color: rgb(63 63 70);
          cursor: pointer;
          border-radius: 4px;
        }
        .status-filter-option:hover {
          background: rgb(244 244 245);
        }
        .status-filter-actions {
          display: flex;
          gap: 8px;
          border-top: 1px solid rgb(244 244 245);
          margin-top: 4px;
          padding: 6px 6px 2px;
        }
        .status-filter-actions button {
          font-size: 11px;
          color: rgb(29 78 216);
        }
        .status-filter-actions button:hover {
          text-decoration: underline;
        }
      `}</style>

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

function Th({
  sortKey,
  sort,
  onSort,
  children,
}: {
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-zinc-900"
      >
        {children}
        {active && (sort.dir === 'asc' ? (
          <ArrowUp className="h-3 w-3" strokeWidth={2} />
        ) : (
          <ArrowDown className="h-3 w-3" strokeWidth={2} />
        ))}
      </button>
    </th>
  );
}

function FilterTh({ children }: { children?: React.ReactNode }) {
  return <th className="px-2 py-1 font-normal align-top">{children}</th>;
}

function GroupBlock({
  label,
  rows,
  returnTo,
  hideLotColumn,
  colCount,
  onOpenPhotos,
}: {
  label: string;
  rows: TacheListRow[];
  returnTo: string;
  hideLotColumn: boolean;
  colCount: number;
  onOpenPhotos: (t: TacheListRow) => void;
}) {
  return (
    <>
      {label && (
        <tr className="bg-zinc-50">
          <td
            colSpan={colCount}
            className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-zinc-700"
          >
            {label}
            <span className="ml-2 text-zinc-400 normal-case font-normal">
              ({rows.length} tâche{rows.length !== 1 ? 's' : ''})
            </span>
          </td>
        </tr>
      )}
      {rows.map((t) => (
        <RowItem
          key={t.id}
          tache={t}
          returnTo={returnTo}
          hideLotColumn={hideLotColumn}
          onOpenPhotos={() => onOpenPhotos(t)}
        />
      ))}
    </>
  );
}

function RowItem({
  tache,
  returnTo,
  hideLotColumn,
  onOpenPhotos,
}: {
  tache: TacheListRow;
  returnTo: string;
  hideLotColumn: boolean;
  onOpenPhotos: () => void;
}) {
  const location = [tache.levelName, tache.roomName].filter(Boolean).join(' · ');
  return (
    <tr className="hover:bg-[#fbf8f0]/40">
      <td className="px-3 py-2">
        <Link
          href={`/marches/${tache.marcheId}?tab=suivi`}
          className="text-blue-700 hover:underline"
        >
          {tache.marcheName}
        </Link>
      </td>
      <td className="px-3 py-2 text-zinc-600">{tache.sousLotName}</td>
      <td className="px-3 py-2 font-medium text-zinc-900">{tache.title}</td>
      <td className="px-3 py-2">
        <TacheStatusSelect tacheId={tache.id} currentStatus={tache.status} />
      </td>
      {!hideLotColumn && (
        <td className="px-3 py-2 text-zinc-600">
          <Link
            href={`/biens/lots/${tache.lotId}`}
            className="hover:text-blue-700"
            title={tache.propertyName}
          >
            {tache.propertyName} · {tache.lotName}
          </Link>
        </td>
      )}
      <td className="px-3 py-2 text-zinc-600">
        {location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            {location}
          </span>
        ) : tache.locationDescription ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            {tache.locationDescription}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 tabular-nums text-zinc-600">
        {tache.dueDate ? (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" strokeWidth={1.75} />
            {formatDateFr(tache.dueDate)}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onOpenPhotos}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-blue-700 hover:bg-blue-50"
          title="Voir / ajouter des photos"
        >
          <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
          {tache.photos.length > 0 && <span className="tabular-nums">{tache.photos.length}</span>}
        </button>
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          href={`/marches/${tache.marcheId}/sous-lots/${tache.sousLotId}/taches/${tache.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          title="Modifier la tâche"
          aria-label="Modifier la tâche"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
        </Link>
      </td>
    </tr>
  );
}

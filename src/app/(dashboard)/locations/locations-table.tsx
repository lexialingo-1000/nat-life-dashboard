'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EntityLink } from '@/components/entity-link';
import { formatDate } from '@/lib/utils';

export type LocationStatus = 'actif' | 'a_venir' | 'inactif';

export type LocationRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  lotId: string;
  lotName: string;
  customerId: string;
  customerLabel: string;
  typeLocation: string;
  dateDebut: string;
  dateFin: string | null;
  status: LocationStatus;
  prixLocation: string | null;
  periodicite: string;
};

export type LocationColumnId =
  | 'customer'
  | 'property'
  | 'lot'
  | 'type'
  | 'dateDebut'
  | 'dateFin'
  | 'prixLocation'
  | 'status'
  | 'actions';

const TYPE_LABELS: Record<string, string> = {
  bail_meuble_annuel: 'Bail meublé annuel',
  bail_nu_annuel: 'Bail nu annuel',
  saisonnier_direct: 'Saisonnier direct',
  saisonnier_plateforme: 'Saisonnier plateforme',
};

const STATUS_LABELS: Record<LocationStatus, string> = {
  actif: 'Actif',
  a_venir: 'À venir',
  inactif: 'Inactif',
};

const STATUS_BADGE: Record<LocationStatus, string> = {
  actif: 'badge-emerald',
  a_venir: 'badge-blue',
  inactif: 'badge-neutral',
};

const PERIODICITE_SUFFIX: Record<string, string> = {
  forfait: 'forfait',
  jour: '/ jour',
  semaine: '/ sem.',
  mois: '/ mois',
  annee: '/ an',
};

interface Props {
  rows: LocationRow[];
  /** Colonnes à masquer selon le contexte parent (fiche client → 'customer' déjà connu, etc.) */
  hideColumns?: LocationColumnId[];
  /** Si fourni, ajoute une colonne Actions avec un bouton corbeille rouge (variant icon DeleteButton). */
  deleteAction?: (formData: FormData) => Promise<void>;
  /** Active la sélection multi-row (case à cocher). Default: false sur les sous-onglets, true sur la liste racine. */
  enableSelection?: boolean;
  /** Message vide. */
  emptyMessage?: string;
}

export function LocationsTable({
  rows,
  hideColumns,
  deleteAction,
  enableSelection = false,
  emptyMessage = 'Aucune location.',
}: Props) {
  const columns = useMemo<ColumnDef<LocationRow>[]>(() => {
    const hidden = new Set<LocationColumnId>(hideColumns ?? []);

    const all: { id: LocationColumnId; def: ColumnDef<LocationRow> }[] = [
      {
        id: 'customer',
        def: {
          accessorKey: 'customerLabel',
          header: 'Locataire',
          cell: ({ row }) => (
            <EntityLink
              href={`/locations/${row.original.id}`}
              className="link-cell whitespace-nowrap font-medium uppercase tracking-[0.04em]"
              title="Clic : aperçu · Double-clic : fiche complète location"
            >
              {row.original.customerLabel}
            </EntityLink>
          ),
        },
      },
      {
        id: 'property',
        def: {
          accessorKey: 'propertyName',
          header: 'Bien',
          cell: ({ row }) => (
            <Link
              href={`/biens/properties/${row.original.propertyId}`}
              className="link-cell-soft whitespace-nowrap"
            >
              {row.original.propertyName}
            </Link>
          ),
        },
      },
      {
        id: 'lot',
        def: {
          accessorKey: 'lotName',
          header: 'Lot',
          cell: ({ row }) => (
            <Link
              href={`/biens/lots/${row.original.lotId}`}
              className="link-cell-soft whitespace-nowrap"
            >
              {row.original.lotName}
            </Link>
          ),
        },
      },
      {
        id: 'type',
        def: {
          accessorKey: 'typeLocation',
          header: 'Type',
          cell: ({ getValue }) => {
            const v = getValue() as string;
            return <span className="badge-neutral">{TYPE_LABELS[v] ?? v}</span>;
          },
        },
      },
      {
        id: 'dateDebut',
        def: {
          accessorKey: 'dateDebut',
          header: 'Début',
          cell: ({ getValue }) => (
            <span className="tnum text-[12px] text-zinc-600">
              {formatDate(getValue() as string)}
            </span>
          ),
        },
      },
      {
        id: 'dateFin',
        def: {
          accessorKey: 'dateFin',
          header: 'Fin',
          cell: ({ getValue }) => {
            const v = getValue() as string | null;
            return (
              <span className="tnum text-[12px] text-zinc-600">
                {v ? formatDate(v) : <span className="italic text-zinc-400">en cours</span>}
              </span>
            );
          },
        },
      },
      {
        id: 'prixLocation',
        def: {
          accessorKey: 'prixLocation',
          header: 'Loyer',
          cell: ({ row }) => {
            const v = row.original.prixLocation;
            if (!v) return <span className="text-[12px] text-zinc-400">—</span>;
            const suffix = PERIODICITE_SUFFIX[row.original.periodicite] ?? '';
            return (
              <span className="tnum whitespace-nowrap text-[12px] text-zinc-700">
                {Number(v).toLocaleString('fr-FR')} € {suffix}
              </span>
            );
          },
        },
      },
      {
        id: 'status',
        def: {
          accessorKey: 'status',
          header: 'Statut',
          cell: ({ getValue }) => {
            const v = getValue() as LocationStatus;
            return <span className={STATUS_BADGE[v]}>{STATUS_LABELS[v]}</span>;
          },
          filterFn: (row, _id, value) => {
            const q = String(value).toLowerCase();
            const status = row.original.status;
            const label = STATUS_LABELS[status].toLowerCase();
            return label.startsWith(q);
          },
        },
      },
    ];

    const visible = all.filter((c) => !hidden.has(c.id)).map((c) => c.def);

    if (deleteAction) {
      visible.push({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableColumnFilter: false,
        size: 48,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DeleteButton
              variant="icon"
              action={deleteAction}
              id={row.original.id}
              label="Supprimer cette location"
              confirmationPhrase={row.original.lotName}
              description={`Supprimer la location de "${row.original.customerLabel}" sur ${row.original.propertyName} · ${row.original.lotName} (du ${formatDate(
                row.original.dateDebut
              )}${
                row.original.dateFin ? ` au ${formatDate(row.original.dateFin)}` : ', en cours'
              }) ? Les documents associés seront aussi supprimés. Action irréversible.`}
            />
          </div>
        ),
      });
    }

    return visible;
  }, [hideColumns, deleteAction]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage={emptyMessage}
      enableSelection={enableSelection}
    />
  );
}

'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EntityLink } from '@/components/entity-link';

export type MarcheRow = {
  id: string;
  supplierId: string;
  supplierLabel: string;
  marcheTypeLabel: string | null;
  // V1.11 R4 — companyName / propertyId / propertyName conservés dans le type
  // pour les autres callsites (delete confirmation, etc.) mais retirés des
  // colonnes affichées.
  companyName: string;
  propertyId: string;
  propertyName: string;
  lotsConcernes: string | null;
  // V1.11 R7 — description du marché affichée en 2ᵉ colonne.
  description: string | null;
  amountHt: string | null;
  status: string;
  // V1.11 R1 — ETAT, dicte styling opacity-75 sur ligne inactive.
  isActive: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

interface Props {
  rows: MarcheRow[];
  // V1.12 R4 — peut retourner { error } pour surfacer FK violation côté UI.
  deleteAction: (formData: FormData) => Promise<void | { error: string }>;
}

export function MarchesTable({ rows, deleteAction }: Props) {
  const columns = useMemo<ColumnDef<MarcheRow>[]>(
    () => [
      {
        accessorKey: 'supplierLabel',
        header: 'Fournisseur',
        cell: ({ row }) => (
          <span className={row.original.isActive ? '' : 'opacity-60'}>
            <EntityLink
              href={`/marches/${row.original.id}`}
              className="link-cell whitespace-nowrap font-medium uppercase tracking-[0.04em]"
              title="Voir la fiche marché"
            >
              {row.original.supplierLabel}
            </EntityLink>
            {!row.original.isActive && (
              <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                Inactif
              </span>
            )}
          </span>
        ),
      },
      // V1.11 R7 — Description en 2ᵉ colonne, entre fournisseur et type.
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue, row }) => {
          const v = getValue() as string | null;
          return (
            <span
              className={`block max-w-[280px] whitespace-normal text-[12px] text-zinc-700 ${
                row.original.isActive ? '' : 'opacity-60'
              }`}
            >
              {v ?? <span className="text-zinc-400">—</span>}
            </span>
          );
        },
        filterFn: (row, _id, value) => {
          const q = String(value).toLowerCase();
          return (row.original.description ?? '').toLowerCase().includes(q);
        },
      },
      {
        accessorKey: 'marcheTypeLabel',
        header: 'Type',
        cell: ({ getValue, row }) => {
          const v = getValue() as string | null;
          if (!v) return <span className="text-zinc-400">—</span>;
          return (
            <span className={`badge-neutral ${row.original.isActive ? '' : 'opacity-60'}`}>
              {v}
            </span>
          );
        },
        filterFn: (row, _id, value) => {
          const q = String(value).toLowerCase();
          return (row.original.marcheTypeLabel ?? '').toLowerCase().includes(q);
        },
      },
      // V1.11 R4 — colonnes Société + Bien retirées (info accessible sur fiche).
      {
        accessorKey: 'lotsConcernes',
        header: 'Lots concernés',
        // V1.11 R6 — filtre activé (était enableColumnFilter:false).
        cell: ({ getValue, row }) => {
          const v = getValue() as string | null;
          return (
            <span
              className={`text-[12px] text-zinc-500 ${row.original.isActive ? '' : 'opacity-60'}`}
            >
              {v ?? <span className="text-zinc-400">parties communes</span>}
            </span>
          );
        },
        filterFn: (row, _id, value) => {
          const q = String(value).toLowerCase();
          return (row.original.lotsConcernes ?? '').toLowerCase().includes(q);
        },
      },
      {
        accessorKey: 'amountHt',
        header: 'Montant HT',
        enableColumnFilter: false,
        cell: ({ getValue, row }) => {
          const v = getValue() as string | null;
          return (
            <span
              className={`tabular-nums text-[13px] ${row.original.isActive ? '' : 'opacity-60'}`}
            >
              {v ? `${Number(v).toLocaleString('fr-FR')} €` : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ getValue, row }) => {
          const v = getValue() as string;
          return (
            <span className={`text-[12px] ${row.original.isActive ? '' : 'opacity-60'}`}>
              {STATUS_LABELS[v] ?? v}
            </span>
          );
        },
      },
      {
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
              label="Supprimer ce marché"
              confirmationPhrase={row.original.supplierLabel}
              description={`Supprimer le marché de "${row.original.supplierLabel}" sur ${row.original.propertyName} ? Les sous-lots techniques, tâches et documents associés seront aussi supprimés. Action irréversible.`}
            />
          </div>
        ),
      },
    ],
    [deleteAction]
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Aucun marché de travaux."
      enableSelection
    />
  );
}

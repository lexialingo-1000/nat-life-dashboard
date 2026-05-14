'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EntityLink } from '@/components/entity-link';

export type MarcheRow = {
  id: string;
  supplierId: string;
  supplierLabel: string;
  marcheTypeLabel: string | null;
  companyName: string;
  propertyId: string;
  propertyName: string;
  lotsConcernes: string | null;
  amountHt: string | null;
  status: string;
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
  deleteAction: (formData: FormData) => Promise<void>;
}

export function MarchesTable({ rows, deleteAction }: Props) {
  const columns = useMemo<ColumnDef<MarcheRow>[]>(
    () => [
      {
        accessorKey: 'supplierLabel',
        header: 'Fournisseur',
        cell: ({ row }) => (
          <EntityLink
            href={`/marches/${row.original.id}`}
            className="link-cell whitespace-nowrap font-medium uppercase tracking-[0.04em]"
            title="Voir la fiche marché"
          >
            {row.original.supplierLabel}
          </EntityLink>
        ),
      },
      {
        accessorKey: 'marcheTypeLabel',
        header: 'Type',
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return <span className="text-zinc-400">—</span>;
          return <span className="badge-neutral">{v}</span>;
        },
        filterFn: (row, _id, value) => {
          const q = String(value).toLowerCase();
          return (row.original.marcheTypeLabel ?? '').toLowerCase().includes(q);
        },
      },
      {
        accessorKey: 'companyName',
        header: 'Société',
        cell: ({ getValue }) => (
          <span className="text-[12px] text-zinc-600">{getValue() as string}</span>
        ),
      },
      {
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
      {
        accessorKey: 'lotsConcernes',
        header: 'Lots concernés',
        enableColumnFilter: false,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return (
            <span className="text-[12px] text-zinc-500">
              {v ?? <span className="text-zinc-400">parties communes</span>}
            </span>
          );
        },
      },
      {
        accessorKey: 'amountHt',
        header: 'Montant HT',
        enableColumnFilter: false,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return (
            <span className="tabular-nums text-[13px]">
              {v ? `${Number(v).toLocaleString('fr-FR')} €` : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return <span className="text-[12px]">{STATUS_LABELS[v] ?? v}</span>;
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

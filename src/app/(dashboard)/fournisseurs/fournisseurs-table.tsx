'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EntityCard } from '@/components/entity-card';

export type FournisseurRow = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  invoicingType: string;
  type: string;
  contactsCount: number;
  isActive: boolean;
};

const INVOICING_LABELS: Record<string, string> = {
  pennylane: 'Pennylane',
  email_forward: 'Email',
  scraping_required: 'Scraping',
  manual_upload: 'Manuel',
};

export const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  notaire: 'Notaire',
  banque: 'Banque',
  juridique: 'Juridique',
  comptabilite: 'Comptabilité',
  architecte: 'Architecte',
  entrepreneur: 'Entrepreneur',
  syndic: 'Syndic',
  diagnostic: 'Diagnostic',
  assurance: 'Assurance',
  autre: 'Autre',
};

// V1.10 I — colonnes Type, Email, Téléphone retirées (cliente Natacha :
// "enleve la premiere colonne on a plus besoin du type de fournisseur.
// La premiere colonne doit etre NOM. Remplacer NOM par FOURNISSEUR.
// Supprime les mails et numero telephone de la liste").
const baseColumns: ColumnDef<FournisseurRow>[] = [
  {
    accessorKey: 'displayName',
    header: 'Fournisseur',
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-medium uppercase tracking-[0.04em]">
        {row.original.displayName}
      </span>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'État',
    cell: ({ getValue }) => {
      const active = getValue() as boolean;
      return (
        <span className={active ? 'badge-emerald' : 'badge-neutral'}>
          {active ? 'Actif' : 'Inactif'}
        </span>
      );
    },
    filterFn: (row, _id, value) => {
      const v = String(value).toLowerCase();
      const active = row.original.isActive;
      if (v === 'a' || v === 'ac' || v === 'act' || 'actif'.startsWith(v)) return active;
      if ('inactif'.startsWith(v)) return !active;
      return true;
    },
  },
  {
    accessorKey: 'contactsCount',
    header: 'Contacts',
    enableColumnFilter: false,
    cell: ({ getValue }) => (
      <span className="tnum tabular-nums text-zinc-600">{getValue() as number}</span>
    ),
  },
  {
    accessorKey: 'invoicingType',
    header: 'Facturation',
    cell: ({ getValue }) => {
      const v = getValue() as string;
      return <span className="badge-neutral">{INVOICING_LABELS[v] ?? v}</span>;
    },
  },
];

interface Props {
  rows: FournisseurRow[];
  // V1.12 R4 — peut retourner { error } pour surfacer FK violation côté UI.
  deleteAction?: (formData: FormData) => Promise<void | { error: string }>;
}

export function FournisseursTable({ rows, deleteAction }: Props) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<FournisseurRow>[]>(() => {
    if (!deleteAction) return baseColumns;
    return [
      ...baseColumns,
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
              label="Supprimer ce fournisseur"
              confirmationPhrase={row.original.displayName}
              description={`Supprimer définitivement le fournisseur "${row.original.displayName}" ? Tous ses contacts et documents associés seront aussi supprimés. Action irréversible.`}
            />
          </div>
        ),
      },
    ];
  }, [deleteAction]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Aucun fournisseur."
      enableSelection
      onRowClick={(r) => router.push(`/fournisseurs/${r.id}`)}
      rowClickIgnoreColumnIds={['select', 'actions']}
      columnVisibilityKey="natlife:fournisseurs-table"
      renderMobileCard={(r) => (
        <EntityCard
          href={`/fournisseurs/${r.id}`}
          title={r.displayName}
          badge={
            <span className={r.isActive ? 'badge-emerald' : 'badge-neutral'}>
              {r.isActive ? 'Actif' : 'Inactif'}
            </span>
          }
          fields={[
            { label: 'Facturation', value: INVOICING_LABELS[r.invoicingType] ?? r.invoicingType },
            ...(r.email ? [{ label: 'Email', value: r.email }] : []),
            ...(r.phone ? [{ label: 'Tél', value: r.phone }] : []),
          ]}
        />
      )}
    />
  );
}

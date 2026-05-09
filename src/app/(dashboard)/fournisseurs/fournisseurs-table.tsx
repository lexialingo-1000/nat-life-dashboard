'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { EntityLink } from '@/components/entity-link';

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

const columns: ColumnDef<FournisseurRow>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => {
      const v = (getValue() as string) ?? 'autre';
      return <span className="badge-neutral whitespace-nowrap">{SUPPLIER_TYPE_LABELS[v] ?? v}</span>;
    },
  },
  {
    accessorKey: 'displayName',
    header: 'Nom',
    cell: ({ row }) => (
      <EntityLink
        href={`/fournisseurs/${row.original.id}`}
        className="link-cell whitespace-nowrap font-medium uppercase tracking-[0.04em]"
        title="Clic : aperçu · Double-clic : fiche complète"
      >
        {row.original.displayName}
      </EntityLink>
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
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue }) => (
      <span className="text-zinc-600">{(getValue() as string | null) ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Téléphone',
    cell: ({ getValue }) => (
      <span className="font-mono text-[12px] text-zinc-600">
        {(getValue() as string | null) ?? '—'}
      </span>
    ),
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

export function FournisseursTable({ rows }: { rows: FournisseurRow[] }) {
  return <DataTable columns={columns} data={rows} emptyMessage="Aucun fournisseur." enableSelection />;
}

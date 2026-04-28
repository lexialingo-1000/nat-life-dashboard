'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';

export type FournisseurRow = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  invoicingType: string;
  contactsCount: number;
  isActive: boolean;
};

const INVOICING_LABELS: Record<string, string> = {
  pennylane: 'Pennylane',
  email_forward: 'Email',
  scraping_required: 'Scraping',
  manual_upload: 'Manuel',
};

const columns: ColumnDef<FournisseurRow>[] = [
  {
    accessorKey: 'displayName',
    header: 'Société / Nom',
    cell: ({ row }) => (
      <Link
        href={`/fournisseurs/${row.original.id}`}
        className="font-medium text-zinc-900 hover:text-emerald-700"
      >
        {row.original.displayName}
      </Link>
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

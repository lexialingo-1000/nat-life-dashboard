'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';

export type SocieteRow = {
  id: string;
  name: string;
  type: string;
  formeJuridique: string | null;
  siren: string | null;
  nafCode: string | null;
  address: string | null;
  isActive: boolean;
};

const columns: ColumnDef<SocieteRow>[] = [
  {
    accessorKey: 'name',
    header: 'Nom',
    cell: ({ row }) => (
      <a href={`/societes/${row.original.id}`} className="link-cell">
        {row.original.name}
      </a>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'État',
    cell: ({ getValue }) => {
      const active = getValue() as boolean;
      return (
        <span className={active ? 'badge-emerald' : 'badge-neutral'}>
          {active ? 'Active' : 'Inactive'}
        </span>
      );
    },
    filterFn: (row, _id, value) => {
      const v = String(value).toLowerCase();
      const active = row.original.isActive;
      if (v === 'a' || v === 'ac' || v === 'act' || 'active'.startsWith(v)) return active;
      if ('inactive'.startsWith(v)) return !active;
      return true;
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => {
      const v = getValue() as string;
      return (
        <span className={v === 'commerciale' ? 'badge-blue' : 'badge-emerald'}>
          {v === 'commerciale' ? 'Commerciale' : 'Immobilière'}
        </span>
      );
    },
  },
  {
    accessorKey: 'formeJuridique',
    header: 'Forme',
    cell: ({ getValue }) => (
      <span className="badge-neutral">{(getValue() as string | null) ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'siren',
    header: 'SIREN',
    cell: ({ getValue }) => (
      <span className="font-mono text-[12px] tnum text-zinc-600">
        {(getValue() as string | null) ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'nafCode',
    header: 'NAF',
    cell: ({ getValue }) => (
      <span className="font-mono text-[12px] text-zinc-600">
        {(getValue() as string | null) ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'address',
    header: 'Siège',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return <span className="text-[12px] text-zinc-500">{v?.split(',')[0] ?? '—'}</span>;
    },
  },
];

export function SocietesTable({ rows }: { rows: SocieteRow[] }) {
  return <DataTable columns={columns} data={rows} emptyMessage="Aucune société." enableSelection />;
}

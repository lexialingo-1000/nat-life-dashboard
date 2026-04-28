'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';

export type BienLotRow = {
  lotId: string;
  lotName: string;
  lotType: string;
  lotStatus: string;
  surfaceCarrez: string | null;
  propertyId: string;
  propertyName: string;
  companyName: string;
  companyId: string;
};

const STATUS_LABELS: Record<string, string> = {
  vacant: 'Vacant',
  loue_annuel: 'Loué annuel',
  loue_saisonnier: 'Loué saisonnier',
  travaux: 'Travaux',
};

const STATUS_BADGES: Record<string, string> = {
  vacant: 'badge-neutral',
  loue_annuel: 'badge-emerald',
  loue_saisonnier: 'badge-blue',
  travaux: 'badge-amber',
};

const columns: ColumnDef<BienLotRow>[] = [
  {
    accessorKey: 'companyName',
    header: 'Société',
    cell: ({ row }) => (
      <Link
        href={`/societes/${row.original.companyId}`}
        className="text-[12px] text-zinc-600 hover:text-amber-700"
      >
        {row.original.companyName}
      </Link>
    ),
  },
  {
    accessorKey: 'propertyName',
    header: 'Bien',
    cell: ({ row }) => (
      <Link
        href={`/biens/properties/${row.original.propertyId}`}
        className="text-zinc-700 hover:text-amber-700"
      >
        {row.original.propertyName}
      </Link>
    ),
  },
  {
    accessorKey: 'lotName',
    header: 'Lot',
    cell: ({ row }) => (
      <Link
        href={`/biens/lots/${row.original.lotId}`}
        className="font-medium text-zinc-900 hover:text-amber-700"
      >
        {row.original.lotName}
      </Link>
    ),
  },
  {
    accessorKey: 'lotType',
    header: 'Type',
    cell: ({ getValue }) => <span className="badge-neutral">{getValue() as string}</span>,
  },
  {
    accessorKey: 'surfaceCarrez',
    header: 'Surface',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return (
        <span className="tnum text-[12px] text-zinc-600">{v ? `${v} m²` : '—'}</span>
      );
    },
  },
  {
    accessorKey: 'lotStatus',
    header: 'Statut',
    cell: ({ getValue }) => {
      const v = getValue() as string;
      return (
        <span className={STATUS_BADGES[v] ?? 'badge-neutral'}>
          {STATUS_LABELS[v] ?? v}
        </span>
      );
    },
  },
];

export function BiensTable({ rows }: { rows: BienLotRow[] }) {
  return <DataTable columns={columns} data={rows} emptyMessage="Aucun lot." />;
}

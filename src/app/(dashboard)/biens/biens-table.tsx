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
  propertyStatut: string | null;
  companyName: string;
  companyId: string;
};

const PROPERTY_STATUT_LABELS: Record<string, string> = {
  en_cours_acquisition: 'En cours acquisition',
  loue_ou_vacant: 'Loué / Vacant',
  vendu: 'Vendu',
};

const PROPERTY_STATUT_BADGES: Record<string, string> = {
  en_cours_acquisition: 'badge-blue',
  loue_ou_vacant: 'badge-emerald',
  vendu: 'badge-neutral',
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
    accessorKey: 'propertyName',
    header: 'Bien',
    cell: ({ row }) => {
      const statut = row.original.propertyStatut;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Link
            href={`/biens/properties/${row.original.propertyId}`}
            className="link-cell font-medium uppercase tracking-[0.04em]"
          >
            {row.original.propertyName}
          </Link>
          {statut && (
            <span className={PROPERTY_STATUT_BADGES[statut] ?? 'badge-neutral'}>
              {PROPERTY_STATUT_LABELS[statut] ?? statut}
            </span>
          )}
        </div>
      );
    },
  },
  {
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
  {
    accessorKey: 'companyName',
    header: 'Société',
    cell: ({ row }) => (
      <Link
        href={`/societes/${row.original.companyId}`}
        className="link-cell-soft whitespace-nowrap text-[12px]"
      >
        {row.original.companyName}
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
  return <DataTable columns={columns} data={rows} emptyMessage="Aucun lot." enableSelection />;
}

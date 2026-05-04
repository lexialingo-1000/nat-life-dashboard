'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';
import { EntityLink } from './entity-link';
import { formatDate } from '@/lib/utils';

export type LotMarcheRow = {
  id: string;
  name: string;
  status: string;
  amountHt: string | null;
  supplierName: string | null;
  dateFinPrevu: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  devis_recu: 'Devis reçu',
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

const STATUS_BADGE: Record<string, string> = {
  devis_recu: 'badge-neutral',
  signe: 'badge-blue',
  en_cours: 'badge-amber',
  livre: 'badge-emerald',
  conteste: 'badge-amber',
  annule: 'badge-neutral',
};

const columns: ColumnDef<LotMarcheRow>[] = [
  {
    accessorKey: 'name',
    header: 'Marché',
    cell: ({ row }) => (
      <EntityLink
        href={`/marches/${row.original.id}`}
        className="link-cell whitespace-nowrap font-medium uppercase tracking-[0.04em]"
        title="Clic : aperçu · Double-clic : fiche complète"
      >
        {row.original.name}
      </EntityLink>
    ),
  },
  {
    accessorKey: 'supplierName',
    header: 'Fournisseur',
    cell: ({ getValue }) => (
      <span className="text-[12px] text-zinc-600">{(getValue() as string | null) ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'amountHt',
    header: 'Montant HT',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return (
        <span className="tnum text-zinc-700">
          {v ? `${Number(v).toLocaleString('fr-FR')} €` : '—'}
        </span>
      );
    },
  },
  {
    accessorKey: 'dateFinPrevu',
    header: 'Fin prévue',
    cell: ({ getValue }) => (
      <span className="tnum text-[12px] text-zinc-600">
        {formatDate(getValue() as string | null)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Statut',
    cell: ({ getValue }) => {
      const s = String(getValue());
      return (
        <span className={STATUS_BADGE[s] ?? 'badge-neutral'}>
          {STATUS_LABELS[s] ?? s}
        </span>
      );
    },
    filterFn: (row, _id, value) => {
      const v = String(value).toLowerCase().trim();
      if (!v) return true;
      const status = row.original.status;
      const label = (STATUS_LABELS[status] ?? status).toLowerCase();
      return label.includes(v) || status.toLowerCase().includes(v);
    },
  },
];

export function LotMarchesTable({ rows }: { rows: LotMarcheRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Aucun marché affecté à ce lot."
    />
  );
}

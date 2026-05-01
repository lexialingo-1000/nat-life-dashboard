'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';
import { EntityLink } from './entity-link';
import { formatDate } from '@/lib/utils';

export type SupplierMarcheRow = {
  id: string;
  name: string;
  status: string;
  amountHt: string | null;
  dateDebutPrevu: string | null;
  dateFinReelle: string | null;
  propertyId: string;
  propertyName: string;
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

const columns: ColumnDef<SupplierMarcheRow>[] = [
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
    accessorKey: 'propertyName',
    header: 'Bien',
    cell: ({ row }) => (
      <EntityLink
        href={`/biens/properties/${row.original.propertyId}`}
        className="link-cell-soft text-[12px]"
      >
        {row.original.propertyName}
      </EntityLink>
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
    accessorKey: 'dateDebutPrevu',
    header: 'Début prévu',
    cell: ({ getValue }) => (
      <span className="tnum text-[12px] text-zinc-600">
        {formatDate(getValue() as string | null)}
      </span>
    ),
  },
  {
    accessorKey: 'dateFinReelle',
    header: 'Fin réelle',
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

export function SupplierMarchesTable({ rows }: { rows: SupplierMarcheRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Aucun marché pour ce fournisseur."
    />
  );
}

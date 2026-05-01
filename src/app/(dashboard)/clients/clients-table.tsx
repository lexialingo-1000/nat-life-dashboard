'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { EntityLink } from '@/components/entity-link';

export type ClientRow = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  tenantType: 'LT' | 'CT' | null;
};

const TENANT_BADGES: Record<string, { label: string; className: string }> = {
  LT: { label: 'Bail long terme', className: 'badge-emerald' },
  CT: { label: 'Saisonnier', className: 'badge-amber' },
};

const columns: ColumnDef<ClientRow>[] = [
  {
    accessorKey: 'displayName',
    header: 'Client',
    cell: ({ row }) => (
      <EntityLink
        href={`/clients/${row.original.id}`}
        className="link-cell whitespace-nowrap font-medium uppercase tracking-[0.04em]"
        title="Clic : aperçu · Double-clic : fiche complète"
      >
        {row.original.displayName}
      </EntityLink>
    ),
  },
  {
    accessorKey: 'tenantType',
    header: 'Statut',
    cell: ({ row }) => {
      const t = row.original.tenantType;
      if (!t) return <span className="text-[12px] text-zinc-400">B2B</span>;
      const cfg = TENANT_BADGES[t];
      return <span className={cfg.className}>{cfg.label}</span>;
    },
    filterFn: (row, _id, value) => {
      const v = String(value).toLowerCase().trim();
      if (!v) return true;
      const t = row.original.tenantType;
      if (v === 'lt' || 'long terme'.startsWith(v) || 'bail'.startsWith(v)) return t === 'LT';
      if (v === 'ct' || 'court terme'.startsWith(v) || 'saisonnier'.startsWith(v)) return t === 'CT';
      if ('b2b'.startsWith(v) || v === 'aucun' || v === '—') return t === null;
      return true;
    },
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
    accessorKey: 'address',
    header: 'Adresse',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return <span className="text-[12px] text-zinc-500">{v?.split(',')[0] ?? '—'}</span>;
    },
  },
];

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  return <DataTable columns={columns} data={rows} emptyMessage="Aucun client." enableSelection />;
}

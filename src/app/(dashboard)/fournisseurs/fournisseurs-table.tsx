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

// V1.10 I — colonnes Type, Email, Téléphone retirées (cliente Natacha :
// "enleve la premiere colonne on a plus besoin du type de fournisseur.
// La premiere colonne doit etre NOM. Remplacer NOM par FOURNISSEUR.
// Supprime les mails et numero telephone de la liste").
const columns: ColumnDef<FournisseurRow>[] = [
  {
    accessorKey: 'displayName',
    header: 'Fournisseur',
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

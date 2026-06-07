'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { DeleteButton } from '@/components/delete-button';
import { EntityLink } from '@/components/entity-link';

export type SocieteRow = {
  id: string;
  name: string;
  type: string;
  siren: string | null;
  tvaIntracom: string | null;
  isActive: boolean;
};

const baseColumns: ColumnDef<SocieteRow>[] = [
  {
    accessorKey: 'name',
    header: 'Société',
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-medium uppercase tracking-[0.04em]">
        {row.original.name}
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
      // V12bis PR6 — couleur distincte commerciale (bleu) vs immobilière (amber).
      // `.badge-emerald` était déjà mappée sur les teintes bleues (Direction A),
      // d'où la confusion visuelle ; on bascule sur badge-amber qui contraste.
      const isComm = v.startsWith('commerciale');
      const hasBilan = v.endsWith('bilan') && !v.endsWith('sans_bilan');
      const label = isComm
        ? hasBilan
          ? 'Commerciale (bilan)'
          : 'Commerciale (sans bilan)'
        : hasBilan
          ? 'Immobilière (bilan)'
          : 'Immobilière (sans bilan)';
      return <span className={isComm ? 'badge-blue' : 'badge-amber'}>{label}</span>;
    },
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
    accessorKey: 'tvaIntracom',
    header: 'N° TVA',
    cell: ({ getValue }) => (
      <span className="font-mono text-[12px] tnum text-zinc-600">
        {(getValue() as string | null) ?? '—'}
      </span>
    ),
  },
];

interface Props {
  rows: SocieteRow[];
  // V1.12 R4 — peut retourner { error } pour surfacer FK violation côté UI.
  deleteAction?: (formData: FormData) => Promise<void | { error: string }>;
}

export function SocietesTable({ rows, deleteAction }: Props) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<SocieteRow>[]>(() => {
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
              label="Supprimer cette société"
              confirmationPhrase={row.original.name}
              description={`Supprimer définitivement la société "${row.original.name}" ? Tous ses biens, lots, marchés, documents et docs comptables associés seront aussi supprimés. Action irréversible.`}
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
      emptyMessage="Aucune société."
      enableSelection
      onRowClick={(r) => router.push(`/societes/${r.id}`)}
      rowClickIgnoreColumnIds={['select', 'actions']}
      columnVisibilityKey="natlife:societes-table"
    />
  );
}

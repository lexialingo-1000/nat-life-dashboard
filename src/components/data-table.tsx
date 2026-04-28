'use client';

import { useEffect, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  /** Affiche un input de filtre par colonne. Default: true. */
  enableFilters?: boolean;
  /** Lignes alternées (zebra). Default: true. */
  striped?: boolean;
  /** Active une colonne checkbox de sélection multi (header + lignes). Default: false. */
  enableSelection?: boolean;
  /** Message vide. */
  emptyMessage?: string;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label': string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className="h-3.5 w-3.5 cursor-pointer rounded-sm border border-zinc-300 text-emerald-600 accent-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:ring-offset-1"
    />
  );
}

export function DataTable<T>({
  columns,
  data,
  enableFilters = true,
  striped = true,
  enableSelection = false,
  emptyMessage = 'Aucune donnée.',
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const allColumns = enableSelection
    ? [
        {
          id: 'select',
          enableSorting: false,
          enableColumnFilter: false,
          size: 36,
          header: ({ table }: { table: any }) => (
            <IndeterminateCheckbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
              aria-label="Tout sélectionner"
            />
          ),
          cell: ({ row }: { row: any }) => (
            <IndeterminateCheckbox
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              aria-label="Sélectionner la ligne"
            />
          ),
        } as ColumnDef<T, any>,
        ...columns,
      ]
    : columns;

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnFilters, rowSelection },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedCount = enableSelection ? Object.keys(rowSelection).length : 0;

  return (
    <div className="overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="border-b border-zinc-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        className={
                          canSort
                            ? 'inline-flex items-center gap-1 hover:text-zinc-900'
                            : 'cursor-default'
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-zinc-400">
                            {sortDir === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </button>
                      {enableFilters && header.column.getCanFilter() && (
                        <input
                          type="text"
                          value={(header.column.getFilterValue() as string) ?? ''}
                          onChange={(e) => header.column.setFilterValue(e.target.value)}
                          placeholder="Filtrer"
                          className="block w-full rounded-sm border border-zinc-200 bg-[#fbf8f0] px-2 py-0.5 text-[11px] font-normal normal-case tracking-normal text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:border-zinc-400"
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-sm text-zinc-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={`transition-colors hover:bg-zinc-50 ${
                  striped && rowIndex % 2 === 1 ? 'bg-zinc-50/40' : ''
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-3.5 text-zinc-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {data.length > 0 && (
        <div className="flex items-center justify-between gap-4 border-t border-zinc-100 px-5 py-2.5 text-[11px] text-zinc-500">
          <span>
            {table.getFilteredRowModel().rows.length} ligne
            {table.getFilteredRowModel().rows.length > 1 ? 's' : ''}
            {columnFilters.length > 0 && data.length !== table.getFilteredRowModel().rows.length && (
              <span> (sur {data.length})</span>
            )}
          </span>
          {enableSelection && selectedCount > 0 && (
            <span className="text-emerald-700">
              {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

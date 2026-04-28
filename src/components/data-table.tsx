'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  /** Affiche un input de filtre par colonne. Default: true. */
  enableFilters?: boolean;
  /** Lignes alternées (zebra). Default: true. */
  striped?: boolean;
  /** Message vide. */
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  enableFilters = true,
  striped = true,
  emptyMessage = 'Aucune donnée.',
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

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
        <div className="border-t border-zinc-100 px-5 py-2.5 text-[11px] text-zinc-500">
          {table.getFilteredRowModel().rows.length} ligne
          {table.getFilteredRowModel().rows.length > 1 ? 's' : ''}
          {columnFilters.length > 0 && data.length !== table.getFilteredRowModel().rows.length && (
            <span> (sur {data.length})</span>
          )}
        </div>
      )}
    </div>
  );
}

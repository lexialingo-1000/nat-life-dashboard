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
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from 'lucide-react';

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  /** Affiche un input de filtre par colonne. Default: true. */
  enableFilters?: boolean;
  /** Lignes alternées (zebra). Default: true. */
  striped?: boolean;
  /** Active une colonne checkbox de sélection multi (header + lignes). Default: false. */
  enableSelection?: boolean;
  /** Tri initial visible (chevron actif au mount). Le user peut le changer en cliquant un header. */
  initialSorting?: SortingState;
  /** Message vide. */
  emptyMessage?: string;
  /** Si fourni, rend chaque ligne cliquable (curseur pointer + onClick). */
  onRowClick?: (row: T) => void;
  /** Ids de colonnes dont le clic ne doit PAS déclencher onRowClick (default: select, actions). */
  rowClickIgnoreColumnIds?: string[];
  /**
   * Clé localStorage pour persister la visibilité des colonnes (dashboard-22 mobile).
   * Quand fourni, affiche un bouton "Colonnes" avec checkboxes par colonne.
   */
  columnVisibilityKey?: string;
  /**
   * Rendu carte mobile (<md). Quand fourni, le tableau est masqué en dessous de md
   * (`hidden md:block`) et remplacé par une pile de cartes utilisant le même row model
   * TanStack (tri/filtres partagés). Absent → comportement inchangé (scroll horizontal).
   */
  renderMobileCard?: (row: T) => React.ReactNode;
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
      className="h-3.5 w-3.5 cursor-pointer rounded-sm border border-zinc-300 text-blue-600 accent-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:ring-offset-1"
    />
  );
}

export function DataTable<T>({
  columns,
  data,
  enableFilters = true,
  striped = true,
  enableSelection = false,
  initialSorting,
  emptyMessage = 'Aucune donnée.',
  onRowClick,
  rowClickIgnoreColumnIds,
  columnVisibilityKey,
  renderMobileCard,
}: Props<T>) {
  const ignoreRowClick = new Set(rowClickIgnoreColumnIds ?? ['select', 'actions']);
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!columnVisibilityKey) return {};
    try {
      const saved = localStorage.getItem(columnVisibilityKey);
      return saved ? (JSON.parse(saved) as VisibilityState) : {};
    } catch {
      return {};
    }
  });
  const [pickerOpen, setPickerOpen] = useState(false);

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
    state: { sorting, columnFilters, rowSelection, columnVisibility },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (columnVisibilityKey) {
          try {
            localStorage.setItem(columnVisibilityKey, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedCount = enableSelection ? Object.keys(rowSelection).length : 0;

  return (
    <div className="overflow-x-auto">
      {columnVisibilityKey && (
        <div className="relative mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
          >
            <Columns3 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Colonnes
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-8 z-30 min-w-[180px] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Colonnes visibles
                </p>
                <div className="space-y-1.5">
                  {table
                    .getAllLeafColumns()
                    .filter((col) => col.id !== 'select' && col.id !== 'actions')
                    .map((col) => {
                      const header = col.columnDef.header;
                      const label = typeof header === 'string' ? header : col.id;
                      return (
                        <label
                          key={col.id}
                          className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-700"
                        >
                          <input
                            type="checkbox"
                            checked={col.getIsVisible()}
                            onChange={col.getToggleVisibilityHandler()}
                            className="h-3.5 w-3.5 rounded border-zinc-300 accent-blue-600"
                          />
                          {label}
                        </label>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {renderMobileCard && (
        <div className="space-y-2 md:hidden">
          {table.getRowModel().rows.length === 0 ? (
            <div className="card p-8 text-center text-sm text-zinc-500">{emptyMessage}</div>
          ) : (
            table
              .getRowModel()
              .rows.map((row) => <div key={row.id}>{renderMobileCard(row.original)}</div>)
          )}
        </div>
      )}
      <table
        className={renderMobileCard ? 'hidden w-full text-[13px] md:table' : 'w-full text-[13px]'}
      >
        <thead className="border-b border-zinc-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500"
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
                          className="hidden w-full rounded-sm border border-zinc-200 bg-[#fbf8f0] px-2 py-0.5 text-[11px] font-normal normal-case tracking-normal text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:border-zinc-400 sm:block"
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
              <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-zinc-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={`transition-colors hover:bg-zinc-50 ${
                  striped && rowIndex % 2 === 1 ? 'bg-zinc-50/40' : ''
                } ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-2 text-zinc-700"
                    onClick={
                      onRowClick && ignoreRowClick.has(cell.column.id)
                        ? (e) => e.stopPropagation()
                        : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {data.length > 0 && (
        <div className="flex items-center justify-between gap-4 border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-500">
          <span>
            {table.getFilteredRowModel().rows.length} ligne
            {table.getFilteredRowModel().rows.length > 1 ? 's' : ''}
            {columnFilters.length > 0 &&
              data.length !== table.getFilteredRowModel().rows.length && (
                <span> (sur {data.length})</span>
              )}
          </span>
          {enableSelection && selectedCount > 0 && (
            <span className="text-blue-700">
              {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

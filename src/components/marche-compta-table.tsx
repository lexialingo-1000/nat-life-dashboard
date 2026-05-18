'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Download, Pencil, Trash2 } from 'lucide-react';
import {
  deleteAccountingDocAction,
  getAccountingDocUrlAction,
} from '@/app/(dashboard)/societes/accounting-actions';

type Kind = 'devis' | 'commande' | 'facture';

const KIND_LABEL: Record<Kind, string> = {
  devis: 'Devis',
  commande: 'Commande',
  facture: 'Facture',
};

const KIND_BADGE: Record<Kind, string> = {
  devis: 'bg-zinc-100 text-zinc-700',
  commande: 'bg-blue-100 text-blue-700',
  facture: 'bg-emerald-100 text-emerald-700',
};

export interface MarcheComptaRow {
  id: string;
  kind: Kind;
  name: string;
  originalFilename: string | null;
  storageKey: string;
  documentDate: string | null;
  amountHt: string | null;
  amountTtc: string | null;
  companyId: string;
  companyName: string;
  supplierId: string;
  supplierLabel: string;
}

interface Props {
  rows: MarcheComptaRow[];
  totalHt: number;
  totalTtc: number;
}

export function MarcheComptaTable({ rows, totalHt, totalTtc }: Props) {
  const [pending, startTransition] = useTransition();

  const handleDownload = (storageKey: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('storageKey', storageKey);
      const res = await getAccountingDocUrlAction(fd);
      if ('url' in res) {
        const a = document.createElement('a');
        a.href = res.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert(`Erreur : ${res.error}`);
      }
    });
  };

  const handleDelete = (row: MarcheComptaRow) => {
    const label = row.originalFilename ?? row.name;
    if (
      !confirm(
        `Supprimer ${KIND_LABEL[row.kind].toLowerCase()} "${label}" ? Cette action est irréversible.`
      )
    )
      return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('documentId', row.id);
      fd.set('companyId', row.companyId);
      await deleteAccountingDocAction(fd);
    });
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-zinc-500">
          {rows.length} document{rows.length > 1 ? 's' : ''} compta
          {' '}lié{rows.length > 1 ? 's' : ''} à ce marché.
        </p>
        <div className="flex flex-col items-end gap-0.5 font-mono text-[12px] tabular-nums text-zinc-700">
          <span>Total HT : {totalHt.toLocaleString('fr-FR')} €</span>
          <span className="font-medium text-zinc-900">
            Total TTC : {totalTtc.toLocaleString('fr-FR')} €
          </span>
        </div>
      </div>

      <table className="table-base">
        <thead>
          <tr>
            <th>Type</th>
            <th>Société</th>
            <th>Fournisseur</th>
            <th>Date document</th>
            <th>Document</th>
            <th className="text-right">HT</th>
            <th className="text-right">TTC</th>
            <th className="text-right"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const fileLabel = d.originalFilename ?? d.name;
            return (
              <tr key={d.id}>
                <td>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${KIND_BADGE[d.kind] ?? ''}`}
                  >
                    {KIND_LABEL[d.kind] ?? d.kind}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/societes/${d.companyId}`}
                    className="link-cell-soft text-[12px]"
                  >
                    {d.companyName}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/fournisseurs/${d.supplierId}`}
                    className="link-cell-soft text-[12px]"
                  >
                    {d.supplierLabel}
                  </Link>
                </td>
                <td className="font-mono text-[12px] tabular-nums text-zinc-700">
                  {d.documentDate ?? '—'}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleDownload(d.storageKey)}
                    disabled={pending}
                    className="link-cell text-left text-[13px] text-zinc-900 disabled:opacity-50"
                    title={d.name}
                  >
                    {fileLabel}
                  </button>
                </td>
                <td className="text-right font-mono tabular-nums text-zinc-500">
                  {d.amountHt ? `${Number(d.amountHt).toLocaleString('fr-FR')} €` : '—'}
                </td>
                <td className="text-right font-mono tabular-nums font-medium">
                  {d.amountTtc ? `${Number(d.amountTtc).toLocaleString('fr-FR')} €` : '—'}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/societes/${d.companyId}/compta/${d.id}/edit`}
                      title="Modifier"
                      className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDownload(d.storageKey)}
                      disabled={pending}
                      title="Télécharger"
                      className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      disabled={pending}
                      title="Supprimer"
                      className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

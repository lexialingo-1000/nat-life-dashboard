'use client';

import { useTransition, useState } from 'react';
import Link from 'next/link';
import { Download, Trash2, Calendar, Home } from 'lucide-react';

/**
 * V1.14 CL-1 — Onglet Compta sur fiche client.
 * Source : Remarques client dashboard-18 §FICHE CLIENTS.
 *
 * Liste les factures / quittances de loyer de toutes les locations du client.
 * Upload se fait depuis la fiche location (onglet Documents) avec le type
 * "Facture loyer" ou "Quittance loyer" (seedés en migration 0027).
 */

export interface ClientComptaRow {
  id: string;
  locationId: string;
  propertyId: string;
  propertyName: string;
  lotId: string;
  lotName: string;
  name: string;
  typeLabel: string;
  typeCode: string;
  storageKey: string;
  documentDate: string | null;
  uploadedAt: string;
}

interface Props {
  rows: ClientComptaRow[];
  getUrlAction: (formData: FormData) => Promise<{ url: string } | { error: string }>;
  deleteAction: (formData: FormData) => Promise<void>;
  emptyMessage: string;
}

function formatDateFr(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ClientComptaTable({ rows, getUrlAction, deleteAction, emptyMessage }: Props) {
  if (rows.length === 0) {
    return <div className="card p-8 text-center text-sm text-zinc-500">{emptyMessage}</div>;
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="border-b border-zinc-100 bg-[#fbf8f0]/60 text-left text-[11px] uppercase tracking-[0.04em] text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Bien · Lot</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Document</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <Row key={r.id} row={r} getUrlAction={getUrlAction} deleteAction={deleteAction} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  row,
  getUrlAction,
  deleteAction,
}: {
  row: ClientComptaRow;
  getUrlAction: Props['getUrlAction'];
  deleteAction: Props['deleteAction'];
}) {
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const fd = new FormData();
      fd.set('storageKey', row.storageKey);
      const res = await getUrlAction(fd);
      if ('url' in res) {
        window.open(res.url, '_blank');
      } else {
        alert(`Téléchargement impossible : ${res.error}`);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = () => {
    if (!confirm(`Supprimer le document "${row.name}" ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', row.id);
      fd.set('storageKey', row.storageKey);
      await deleteAction(fd);
    });
  };

  return (
    <tr className="hover:bg-[#fbf8f0]/40">
      <td className="px-3 py-2 tabular-nums text-zinc-700">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" strokeWidth={1.75} />
          {formatDateFr(row.documentDate)}
        </span>
      </td>
      <td className="px-3 py-2">
        <Link
          href={`/locations/${row.locationId}`}
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
        >
          <Home className="h-3 w-3" strokeWidth={1.75} />
          {row.propertyName} · {row.lotName}
        </Link>
      </td>
      <td className="px-3 py-2 text-zinc-600">
        <span className="badge-neutral">{row.typeLabel}</span>
      </td>
      <td className="px-3 py-2 font-medium text-zinc-900">{row.name}</td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            title="Télécharger"
            aria-label="Télécharger"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            title="Supprimer"
            aria-label="Supprimer"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

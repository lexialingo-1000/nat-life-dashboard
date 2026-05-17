'use client';

import { useTransition } from 'react';
import { Download, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';

interface Props {
  documentId: string;
  storageKey: string;
  companyId: string;
  docName: string;
  getUrlAction: (formData: FormData) => Promise<{ url: string } | { error: string }>;
  deleteAction: (formData: FormData) => Promise<void>;
}

/**
 * V12bis umbrella §3 — actions inline sur table compta de la Fiche Fournisseur.
 * Retours Natacha dashboard-13 : "Je dois pouvoir visualiser et modifier la fiche
 * du document comptable à partir de la fiche fournisseur. Je veux voir la PJ".
 *
 * Boutons :
 * - Modifier  : link vers /societes/[companyId]?tab=compta (édition inline gérée
 *   sur la fiche société pour V12bis, route /edit dédiée prévue C6).
 * - PJ       : presigned URL via getUrlAction → ouverture nouvel onglet.
 * - Supprimer : confirm + delete via deleteAction (réutilise l'action de la
 *   fiche société).
 */
export function SupplierComptaRowActions({
  documentId,
  storageKey,
  companyId,
  docName,
  getUrlAction,
  deleteAction,
}: Props) {
  const [pending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('storageKey', storageKey);
      const res = await getUrlAction(fd);
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

  const handleDelete = () => {
    if (
      !confirm(
        `Supprimer le document compta "${docName}" ? Cette action est irréversible et supprime aussi le fichier MinIO.`
      )
    )
      return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('documentId', documentId);
      fd.set('companyId', companyId);
      await deleteAction(fd);
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/societes/${companyId}/compta/${documentId}/edit`}
        title="Modifier le document compta"
        className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={handleDownload}
        disabled={pending}
        title="Télécharger la PJ"
        className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Supprimer le document compta"
        className="rounded p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

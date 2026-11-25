'use client';

// Retours 24/11/2026 pt 7 — onglet « Contrats » de la fiche lot : liste, création, édition,
// suppression (admin). Pièce jointe : /api/upload (scope `lots`, parentSlug `contrats`) → PUT MinIO
// → la clé part avec le formulaire, contrôlée côté serveur (isLotContractKey).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Paperclip, Pencil, Plus, Save } from 'lucide-react';
import { DeleteButton } from './delete-button';
import { formatDate } from '@/lib/utils';
import { openSignedUrl } from '@/lib/open-file';
import { LOT_CONTRACT_SLUG } from '@/lib/storage/keys';
import {
  createLotContractAction,
  updateLotContractAction,
  deleteLotContractAction,
  getLotContractFileUrlAction,
} from '@/app/(dashboard)/biens/lots/contract-actions';

export type LotContractRow = {
  id: string;
  typeId: string;
  typeLabel: string;
  startDate: string | null;
  endDate: string | null;
  contractNumber: string | null;
  customerNumber: string | null;
  comment: string | null;
  fileName: string | null;
  hasFile: boolean;
  /** Calculé côté serveur (date du jour à Paris) : fin de contrat passée. */
  isExpired: boolean;
};

export type ContractTypeOption = { id: string; label: string; isActive: boolean };

interface Props {
  lotId: string;
  contracts: LotContractRow[];
  types: ContractTypeOption[];
}

async function uploadContractFile(lotId: string, file: File): Promise<string> {
  const presignRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'lots',
      parentSlug: LOT_CONTRACT_SLUG,
      parentId: lotId,
      fileName: file.name,
    }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Erreur upload (${presignRes.status})`);
  }
  const { uploadUrl, storageKey } = (await presignRes.json()) as {
    uploadUrl: string;
    storageKey: string;
  };
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!putRes.ok) throw new Error(`Upload MinIO échoué (${putRes.status})`);
  return storageKey;
}

export function LotContractsManager({ lotId, contracts, types }: Props) {
  // null = formulaire fermé ; 'new' = création ; sinon id du contrat édité.
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const editedRow = editing && editing !== 'new' ? contracts.find((c) => c.id === editing) : null;

  const openFile = (id: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await openSignedUrl(() => getLotContractFileUrlAction(fd));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium tracking-tight text-zinc-900">Contrats du lot</h2>
        {editing === null && (
          <button type="button" onClick={() => setEditing('new')} className="btn-secondary">
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Nouveau contrat
          </button>
        )}
      </div>

      {editing !== null && (
        <ContractForm
          key={editing}
          lotId={lotId}
          row={editedRow ?? null}
          types={types}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="card overflow-x-auto">
        {contracts.length === 0 ? (
          <p className="p-6 text-[13px] text-zinc-500">
            Aucun contrat pour ce lot (eau, électricité, internet, assurance…).
          </p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Type</th>
                <th>N° contrat</th>
                <th>N° client</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Commentaire</th>
                <th>PJ</th>
                <th className="w-[90px] pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-zinc-900">{c.typeLabel}</td>
                  <td className="font-mono text-[12px]">{c.contractNumber ?? '—'}</td>
                  <td className="font-mono text-[12px]">{c.customerNumber ?? '—'}</td>
                  <td className="tnum">{formatDate(c.startDate)}</td>
                  <td className="tnum whitespace-nowrap">
                    {formatDate(c.endDate)}
                    {c.isExpired && <span className="badge-red ml-2">échu</span>}
                  </td>
                  <td className="max-w-[280px] whitespace-pre-line text-[12px] text-zinc-600">
                    {c.comment ?? '—'}
                  </td>
                  <td>
                    {c.hasFile ? (
                      <button
                        type="button"
                        onClick={() => openFile(c.id)}
                        className="inline-flex max-w-[180px] items-center gap-1 text-[12px] text-blue-700 hover:text-blue-800"
                        title={c.fileName ?? 'Pièce jointe'}
                      >
                        <Paperclip className="h-3 w-3 shrink-0" strokeWidth={2} />
                        <span className="truncate">{c.fileName ?? 'Ouvrir'}</span>
                      </button>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="pr-5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(c.id)}
                        title="Modifier ce contrat"
                        aria-label="Modifier ce contrat"
                        className="rounded p-1.5 text-blue-700 transition hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <DeleteButton
                        variant="icon"
                        action={deleteLotContractAction}
                        id={c.id}
                        label="Supprimer ce contrat"
                        confirmationPhrase={c.typeLabel}
                        description={`Supprimer le contrat « ${c.typeLabel} »${
                          c.contractNumber ? ` n° ${c.contractNumber}` : ''
                        } et sa pièce jointe ? Cette action est irréversible.`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ContractForm({
  lotId,
  row,
  types,
  onDone,
}: {
  lotId: string;
  row: LotContractRow | null;
  types: ContractTypeOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Types actifs + le type actuel du contrat, même désactivé.
  const options = types.filter((t) => t.isActive || t.id === row?.typeId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.delete('file');
    setPending(true);
    try {
      if (file) {
        fd.set('storageKey', await uploadContractFile(lotId, file));
        fd.set('fileName', file.name);
      } else if (removeAttachment) {
        fd.set('removeAttachment', '1');
      }
      const res = row ? await updateLotContractAction(fd) : await createLotContractAction(fd);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <h3 className="text-[14px] font-medium text-zinc-900">
        {row ? `Modifier le contrat « ${row.typeLabel} »` : 'Nouveau contrat'}
      </h3>
      {row ? (
        <input type="hidden" name="id" value={row.id} />
      ) : (
        <input type="hidden" name="lotId" value={lotId} />
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800"
        >
          {error}
        </div>
      )}

      {options.length === 0 && (
        <p className="text-[13px] text-zinc-500">
          Aucun type de contrat actif : en ajouter dans Paramètres → Types de contrat.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Type *</label>
          <select name="typeId" required defaultValue={row?.typeId ?? ''} className="input mt-1">
            <option value="" disabled>
              Choisir…
            </option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.isActive ? '' : ' (désactivé)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">N° de contrat</label>
          <input
            name="contractNumber"
            defaultValue={row?.contractNumber ?? ''}
            maxLength={255}
            className="input mt-1 font-mono"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">N° de client</label>
          <input
            name="customerNumber"
            defaultValue={row?.customerNumber ?? ''}
            maxLength={255}
            className="input mt-1 font-mono"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Date de début</label>
          <input
            type="date"
            name="startDate"
            defaultValue={row?.startDate ?? ''}
            className="input mt-1 tnum"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Date de fin</label>
          <input
            type="date"
            name="endDate"
            defaultValue={row?.endDate ?? ''}
            className="input mt-1 tnum"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Pièce jointe</label>
          <input
            type="file"
            name="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-[12px] text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-[12px]"
          />
          {row?.hasFile && !file && (
            <label className="mt-1.5 flex items-center gap-2 text-[12px] text-zinc-600">
              <input
                type="checkbox"
                checked={removeAttachment}
                onChange={(e) => setRemoveAttachment(e.target.checked)}
                className="h-3.5 w-3.5 rounded-sm border-zinc-300"
              />
              Retirer « {row.fileName ?? 'pièce jointe'} »
            </label>
          )}
          {row?.hasFile && file && (
            <p className="mt-1 text-[11px] text-zinc-500">Remplacera « {row.fileName} ».</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Commentaire</label>
        <textarea
          name="comment"
          rows={2}
          maxLength={2000}
          defaultValue={row?.comment ?? ''}
          className="input mt-1"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} disabled={pending} className="btn-secondary">
          Annuler
        </button>
        <button type="submit" disabled={pending || options.length === 0} className="btn-primary">
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : row ? (
            <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          )}
          {row ? 'Enregistrer' : 'Créer le contrat'}
        </button>
      </div>
    </form>
  );
}

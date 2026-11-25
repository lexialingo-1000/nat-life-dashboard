'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { TacheLotLocationFieldset } from '@/components/tache-lot-location-fieldset';
import { createTacheAction, type CreateTacheState } from '@/app/(dashboard)/marches/actions';
import {
  TachePendingPhotos,
  useUploadPendingPhotos,
  type PendingPhoto,
} from '@/components/tache-pending-photos';

// V1.13 R5 — 'en_attente' ajouté en tête (Remarques client dashboard-17).
const STATUS_OPTIONS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'a_faire', label: 'À faire' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'valide', label: 'Validé' },
];

interface LotOption {
  id: string;
  name: string;
}
interface Room {
  id: string;
  name: string;
}
interface Level {
  id: string;
  name: string;
  rooms: Room[];
}
interface LotStructure {
  lotId: string;
  levels: Level[];
}
interface ContactOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

interface Props {
  sousLotId: string;
  returnTo: string;
  lotOptions: LotOption[];
  lotsStructure: LotStructure[];
  contacts: ContactOption[];
}

const initialState: CreateTacheState = { status: 'idle' };

function SubmitButton({ disabled, uploading }: { disabled: boolean; uploading?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={disabled || pending || uploading}>
      {pending || uploading ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          {uploading ? 'Envoi des photos…' : 'Création…'}
        </>
      ) : (
        <>
          <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          Créer la tâche
        </>
      )}
    </button>
  );
}

export function TacheCreateForm({
  sousLotId,
  returnTo,
  lotOptions,
  lotsStructure,
  contacts,
}: Props) {
  const [state, formAction] = useFormState(createTacheAction, initialState);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  // Retours 24/11/2026 pt 8 — photos envoyées juste après la création (id de la tâche requis).
  const photoUpload = useUploadPendingPhotos(state, pendingPhotos);

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <input type="hidden" name="marcheSousLotId" value={sousLotId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {pendingPhotos.length > 0 && <input type="hidden" name="hasPhotos" value="1" />}

      {state.status === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" strokeWidth={2} />
          <div className="text-[13px] text-red-800">{state.message}</div>
        </div>
      )}
      {photoUpload.failure && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
          <div className="text-[13px] text-amber-800">
            {photoUpload.failure.message}{' '}
            <Link href={photoUpload.failure.returnTo} className="underline">
              Continuer
            </Link>
          </div>
        </div>
      )}

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Titre *</label>
        <input
          name="title"
          required
          className="input mt-1"
          placeholder="Carrelage salle de bain RDC"
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Échéance</label>
          <input type="date" name="dueDate" className="input mt-1" autoComplete="off" />
          <p className="mt-1 text-[11px] text-zinc-500">Date limite prévue pour la tâche.</p>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Description</label>
          <textarea
            name="description"
            rows={2}
            className="input mt-1"
            placeholder="Détails (optionnel)"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>
      </div>

      <TacheLotLocationFieldset lotOptions={lotOptions} lotsStructure={lotsStructure} required />

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Statut initial</label>
        <select name="status" defaultValue="a_faire" className="input mt-1">
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Contact fournisseur</label>
        <select name="supplierContactId" defaultValue="" className="input mt-1">
          <option value="">— Aucun contact spécifique —</option>
          {contacts.map((c) => {
            const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';
            return (
              <option key={c.id} value={c.id}>
                {name}
              </option>
            );
          })}
        </select>
        {contacts.length === 0 && (
          <p className="mt-1 text-[11px] text-zinc-500">
            Aucun contact enregistré sur ce fournisseur.
          </p>
        )}
      </div>

      <TachePendingPhotos
        photos={pendingPhotos}
        onChange={setPendingPhotos}
        disabled={photoUpload.created}
      />

      <div className="flex justify-end gap-3 pt-2">
        <Link href={returnTo} className="btn-secondary">
          Annuler
        </Link>
        <SubmitButton
          disabled={lotOptions.length === 0 || photoUpload.created}
          uploading={photoUpload.uploading}
        />
      </div>
    </form>
  );
}

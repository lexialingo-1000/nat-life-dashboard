'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import {
  createTacheAction,
  type CreateTacheState,
} from '@/app/(dashboard)/marches/actions';

// V20 §FICHE LOT §4 — ajout de tâche depuis fournisseur / bien / lot : le
// marché et le sous-lot sont SÉLECTIONNABLES dans le formulaire (réponse
// cliente : "choisir le marché dans le form"). Pas de migration DB.

const STATUS_OPTIONS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'a_faire', label: 'À faire' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'valide', label: 'Validé' },
];

export interface MarcheOption {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
}
export interface SousLotOption {
  id: string;
  name: string;
}
export interface LotOption {
  id: string;
  name: string;
}

interface Props {
  marches: MarcheOption[];
  /** Sous-lots indexés par marché. */
  sousLotsByMarche: Record<string, SousLotOption[]>;
  /** Lots immo indexés par propertyId (pour scoper le choix du lot au bien du marché). */
  lotsByProperty: Record<string, LotOption[]>;
  defaultMarcheId?: string;
  defaultLotId?: string;
  returnTo: string;
}

const initialState: CreateTacheState = { status: 'idle' };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={disabled || pending}>
      {pending ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Création…
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

export function TacheCreateSelectableForm({
  marches,
  sousLotsByMarche,
  lotsByProperty,
  defaultMarcheId,
  defaultLotId,
  returnTo,
}: Props) {
  const [state, formAction] = useFormState(createTacheAction, initialState);
  const [marcheId, setMarcheId] = useState<string>(defaultMarcheId ?? '');

  const selectedMarche = marches.find((m) => m.id === marcheId);
  const sousLots = marcheId ? sousLotsByMarche[marcheId] ?? [] : [];
  const lotOptions = selectedMarche ? lotsByProperty[selectedMarche.propertyId] ?? [] : [];

  // Sous-lot par défaut : le premier du marché sélectionné.
  const [sousLotId, setSousLotId] = useState<string>('');
  const effectiveSousLotId = useMemo(() => {
    if (sousLotId && sousLots.some((s) => s.id === sousLotId)) return sousLotId;
    return sousLots[0]?.id ?? '';
  }, [sousLotId, sousLots]);

  // Lot par défaut : defaultLotId si dans le bien du marché, sinon le premier.
  const [lotId, setLotId] = useState<string>(defaultLotId ?? '');
  const effectiveLotId = useMemo(() => {
    if (lotId && lotOptions.some((l) => l.id === lotId)) return lotId;
    if (defaultLotId && lotOptions.some((l) => l.id === defaultLotId)) return defaultLotId;
    return lotOptions[0]?.id ?? '';
  }, [lotId, defaultLotId, lotOptions]);

  const noMarche = marches.length === 0;
  const marcheHasNoSousLot = !!marcheId && sousLots.length === 0;
  const canSubmit = !!marcheId && !!effectiveSousLotId && !!effectiveLotId;

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <input type="hidden" name="returnTo" value={returnTo} />

      {state.status === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" strokeWidth={2} />
          <div className="text-[13px] text-red-800">{state.message}</div>
        </div>
      )}

      {noMarche ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
          Aucun marché de travaux disponible dans ce contexte. Créez d&apos;abord un marché (avec
          au moins un sous-lot) avant d&apos;ajouter une tâche.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Marché *</label>
              <select
                name="__marcheId"
                value={marcheId}
                onChange={(e) => {
                  setMarcheId(e.target.value);
                  setSousLotId('');
                  setLotId('');
                }}
                required
                className="input mt-1"
              >
                <option value="">— Choisir un marché —</option>
                {marches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.propertyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Sous-lot *</label>
              <select
                name="marcheSousLotId"
                value={effectiveSousLotId}
                onChange={(e) => setSousLotId(e.target.value)}
                required
                disabled={!marcheId || marcheHasNoSousLot}
                className="input mt-1"
              >
                {sousLots.length === 0 ? (
                  <option value="">— Aucun sous-lot —</option>
                ) : (
                  sousLots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
              {marcheHasNoSousLot && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Ce marché n&apos;a pas de sous-lot. Ajoutez-en un depuis la fiche marché (onglet
                  Suivi travaux) avant de créer une tâche.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Lot concerné *</label>
            <select
              name="lotId"
              value={effectiveLotId}
              onChange={(e) => setLotId(e.target.value)}
              required
              disabled={!marcheId}
              className="input mt-1"
            >
              {lotOptions.length === 0 ? (
                <option value="">— Aucun lot —</option>
              ) : (
                lotOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              )}
            </select>
          </div>

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Échéance</label>
              <input type="date" name="dueDate" className="input mt-1" autoComplete="off" />
            </div>
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
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Link href={returnTo} className="btn-secondary">
          Annuler
        </Link>
        {!noMarche && <SubmitButton disabled={!canSubmit} />}
      </div>
    </form>
  );
}

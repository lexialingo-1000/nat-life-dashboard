'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, Loader2, Plus, Save, X } from 'lucide-react';
import {
  createTacheAction,
  type CreateTacheState,
} from '@/app/(dashboard)/marches/actions';
import { MarcheInlineCreator } from '@/components/marche-inline-creator';

// V20 §FICHE LOT §4 + V12.1 — ajout de tâche depuis fournisseur / bien / lot :
// marché et sous-lot SÉLECTIONNABLES, avec création à la volée d'un marché
// (sélecteur fournisseur+bien) ET d'un sous-lot, sans quitter la page.

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
export interface SupplierOption {
  id: string;
  label: string;
}

type InlineCreateMarche = (
  formData: FormData
) => Promise<{ id: string; label: string } | { error: string }>;
type InlineCreateSousLot = (
  formData: FormData
) => Promise<{ id: string; name: string } | { error: string }>;

interface Props {
  marches: MarcheOption[];
  /** Sous-lots indexés par marché. */
  sousLotsByMarche: Record<string, SousLotOption[]>;
  /** Lots immo indexés par propertyId. */
  lotsByProperty: Record<string, LotOption[]>;
  /** Fournisseurs (pour création marché à la volée). */
  suppliers: SupplierOption[];
  /** Biens (pour création marché à la volée). */
  properties: SupplierOption[];
  createMarcheAction: InlineCreateMarche;
  createSousLotAction: InlineCreateSousLot;
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
  suppliers,
  properties,
  createMarcheAction,
  createSousLotAction,
  defaultMarcheId,
  defaultLotId,
  returnTo,
}: Props) {
  const [state, formAction] = useFormState(createTacheAction, initialState);

  // État local : les listes peuvent grandir via création inline.
  const [marcheList, setMarcheList] = useState<MarcheOption[]>(marches);
  const [sousLotsMap, setSousLotsMap] =
    useState<Record<string, SousLotOption[]>>(sousLotsByMarche);
  const [lotsMap] = useState<Record<string, LotOption[]>>(lotsByProperty);

  const [marcheId, setMarcheId] = useState<string>(defaultMarcheId ?? '');
  const [sousLotId, setSousLotId] = useState<string>('');
  const [lotId, setLotId] = useState<string>(defaultLotId ?? '');

  const selectedMarche = marcheList.find((m) => m.id === marcheId);
  const sousLots = marcheId ? sousLotsMap[marcheId] ?? [] : [];
  const lotOptions = selectedMarche ? lotsMap[selectedMarche.propertyId] ?? [] : [];

  const effectiveSousLotId = useMemo(() => {
    if (sousLotId && sousLots.some((s) => s.id === sousLotId)) return sousLotId;
    return sousLots[0]?.id ?? '';
  }, [sousLotId, sousLots]);

  const effectiveLotId = useMemo(() => {
    if (lotId && lotOptions.some((l) => l.id === lotId)) return lotId;
    if (defaultLotId && lotOptions.some((l) => l.id === defaultLotId)) return defaultLotId;
    return lotOptions[0]?.id ?? '';
  }, [lotId, defaultLotId, lotOptions]);

  // --- Création inline d'un sous-lot (pas de <form> imbriqué : onClick) ---
  const [showSousLot, setShowSousLot] = useState(false);
  const [newSousLotName, setNewSousLotName] = useState('');
  const [creatingSousLot, setCreatingSousLot] = useState(false);
  const [sousLotError, setSousLotError] = useState<string | null>(null);

  const handleCreateSousLot = async () => {
    if (!marcheId || !newSousLotName.trim()) return;
    setCreatingSousLot(true);
    setSousLotError(null);
    const fd = new FormData();
    fd.set('marcheId', marcheId);
    fd.set('name', newSousLotName.trim());
    const res = await createSousLotAction(fd);
    setCreatingSousLot(false);
    if ('error' in res) {
      setSousLotError(res.error);
      return;
    }
    setSousLotsMap((prev) => ({
      ...prev,
      [marcheId]: [...(prev[marcheId] ?? []), { id: res.id, name: res.name }],
    }));
    setSousLotId(res.id);
    setNewSousLotName('');
    setShowSousLot(false);
  };

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
              setShowSousLot(false);
            }}
            required
            className="input mt-1"
          >
            <option value="">— Choisir un marché —</option>
            {marcheList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.propertyName}
              </option>
            ))}
          </select>
          <MarcheInlineCreator
            supplierId=""
            suppliers={suppliers}
            properties={properties}
            createAction={createMarcheAction}
            onCreated={({ id, label, propertyId }) => {
              const propertyName = properties.find((p) => p.id === propertyId)?.label ?? '';
              setMarcheList((prev) => [
                { id, name: label, propertyId, propertyName },
                ...prev.filter((m) => m.id !== id),
              ]);
              setSousLotsMap((prev) => ({ ...prev, [id]: prev[id] ?? [] }));
              setMarcheId(id);
              setSousLotId('');
              setLotId('');
            }}
          />
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

          {marcheId && !showSousLot && (
            <button
              type="button"
              onClick={() => setShowSousLot(true)}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline"
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
              Créer un sous-lot
            </button>
          )}
          {marcheHasNoSousLot && !showSousLot && (
            <p className="mt-1 text-[11px] text-amber-700">
              Ce marché n&apos;a pas encore de sous-lot — créez-en un ci-dessus.
            </p>
          )}

          {showSousLot && (
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-zinc-200 bg-[#fbf8f0] p-2">
              <div className="min-w-[160px] flex-1">
                <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Nouveau sous-lot
                </label>
                <input
                  value={newSousLotName}
                  onChange={(e) => setNewSousLotName(e.target.value)}
                  placeholder="Plomberie, Électricité…"
                  className="input mt-1"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateSousLot();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleCreateSousLot}
                disabled={creatingSousLot || !newSousLotName.trim()}
                className="btn-primary"
              >
                {creatingSousLot ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Ajouter'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSousLot(false);
                  setSousLotError(null);
                }}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
                aria-label="Annuler"
              >
                <X className="h-4 w-4" />
              </button>
              {sousLotError && (
                <p className="w-full text-[11px] text-red-700">{sousLotError}</p>
              )}
            </div>
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

      <div className="flex justify-end gap-3 pt-2">
        <Link href={returnTo} className="btn-secondary">
          Annuler
        </Link>
        <SubmitButton disabled={!canSubmit} />
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EntityCombobox } from '@/components/entity-combobox';

// v19-3 — champ Statut retiré du formulaire (demande client v19). Le statut
// reste géré côté DB avec default `devis_recu` ; les badges restent affichés
// sur la liste/fiche/tree (cf. plan V1.15).

interface LotOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  label: string;
}

interface MarcheTypeOption {
  id: string;
  label: string;
}

export interface MarcheFormValues {
  id?: string;
  supplierId?: string;
  marcheTypeId?: string | null;
  description?: string | null;
  amountHt?: string | null;
  amountTtc?: string | null;
  dateDevis?: string | null;
  dateSignature?: string | null;
  dateDebutPrevu?: string | null;
  dateFinPrevu?: string | null;
  status?: string;
  // V1.11 R1 — ETAT du marché (ACTIF/INACTIF). Présent uniquement en mode édition.
  isActive?: boolean;
  notes?: string | null;
  lotIds?: string[];
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  propertyId: string;
  propertyName: string;
  lots: LotOption[];
  suppliers: SupplierOption[];
  marcheTypes: MarcheTypeOption[];
  defaultValues?: MarcheFormValues;
  cancelHref: string;
  submitLabel?: string;
  /** Si fourni, l'action serveur redirige vers ce chemin après création/édition
   * au lieu d'aller sur la fiche marché. Permet de rester sur la fiche bien
   * lorsqu'on crée un marché depuis le contexte d'un bien. */
  returnTo?: string;
  /** Server action pour créer un fournisseur à la volée depuis le combobox.
   * Si fourni, expose un bouton "+ Créer un fournisseur" dans la liste déroulante. */
  createSupplierAction?: (
    formData: FormData,
  ) => Promise<{ id: string; label: string } | { error: string }>;
}

export function MarcheForm({
  action,
  propertyId,
  propertyName,
  lots,
  suppliers,
  marcheTypes,
  defaultValues = {},
  cancelHref,
  submitLabel = 'Enregistrer',
  returnTo,
  createSupplierAction,
}: Props) {
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(
    new Set(defaultValues.lotIds ?? []),
  );

  const toggleLot = (lotId: string) => {
    const next = new Set(selectedLotIds);
    if (next.has(lotId)) next.delete(lotId);
    else next.add(lotId);
    setSelectedLotIds(next);
  };

  return (
    <form action={action} className="card space-y-5 p-6">
      <input type="hidden" name="propertyId" value={propertyId} />
      {defaultValues.id && <input type="hidden" name="id" value={defaultValues.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {Array.from(selectedLotIds).map((lotId) => (
        <input key={lotId} type="hidden" name="lotIds" value={lotId} />
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium">Description</label>
          <textarea
            name="description"
            defaultValue={defaultValues.description ?? ''}
            rows={3}
            className="input mt-1"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium">Fournisseur *</label>
          <div className="mt-1">
            <EntityCombobox
              name="supplierId"
              options={suppliers}
              defaultValue={defaultValues.supplierId}
              placeholder="Rechercher un fournisseur…"
              createLabel="+ Créer un fournisseur"
              createAction={createSupplierAction}
              createFields={['companyName', 'firstName', 'lastName', 'email', 'phone']}
              required
            />
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium">Type de travaux</label>
          <div className="mt-1">
            <EntityCombobox
              name="marcheTypeId"
              options={marcheTypes}
              defaultValue={defaultValues.marcheTypeId ?? undefined}
              placeholder="(optionnel) Plomberie, Peinture, Maçonnerie…"
            />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Optionnel. Tu peux aussi laisser vide et catégoriser plus finement les sous-lots.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Montant HT (€)</label>
          <input
            name="amountHt"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues.amountHt ?? ''}
            className="input mt-1 tabular-nums"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Montant TTC (€)</label>
          <input
            name="amountTtc"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues.amountTtc ?? ''}
            className="input mt-1 tabular-nums"
          />
        </div>

        <input type="hidden" name="dateDevis" value={defaultValues.dateDevis ?? ''} />
        <input type="hidden" name="dateSignature" value={defaultValues.dateSignature ?? ''} />

        <div>
          <label className="block text-sm font-medium">Début prévu</label>
          <input
            name="dateDebutPrevu"
            type="date"
            defaultValue={defaultValues.dateDebutPrevu ?? ''}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Fin prévue</label>
          <input
            name="dateFinPrevu"
            type="date"
            defaultValue={defaultValues.dateFinPrevu ?? ''}
            className="input mt-1"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            defaultValue={defaultValues.notes ?? ''}
            rows={3}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        {/* V1.11 R1 — ETAT du marché. Toggle visible uniquement en mode édition.
            À la création, la valeur est forcée par défaut à true côté DB. */}
        {defaultValues.id && (
          <div className="col-span-2">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-zinc-200 bg-[#fbf8f0] p-3">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={defaultValues.isActive ?? true}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <div>
                <div className="text-sm font-medium">Marché actif</div>
                <p className="text-[11px] text-zinc-500">
                  Décocher pour archiver le marché. Les marchés inactifs sont masqués par défaut
                  dans la liste (toggle « Afficher inactifs » pour les revoir).
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Lots concernés sur {propertyName}</h3>
          <span className="text-xs text-zinc-500">
            {selectedLotIds.size === 0
              ? 'Aucun (parties communes / structurel)'
              : `${selectedLotIds.size} sélectionné${selectedLotIds.size > 1 ? 's' : ''}`}
          </span>
        </div>
        {lots.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Ce bien n'a pas encore de lots. Le marché sera rattaché au bien (parties communes).
          </p>
        ) : (
          <ul className="space-y-1.5">
            {lots.map((lot) => (
              <li key={lot.id}>
                <label className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-[#fbf8f0]">
                  <input
                    type="checkbox"
                    checked={selectedLotIds.has(lot.id)}
                    onChange={() => toggleLot(lot.id)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  {lot.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Laisse vide pour un marché de parties communes (toiture, façade, ascenseur…). Coche un ou
          plusieurs lots si les travaux sont localisés.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={cancelHref} className="btn-secondary">
          Annuler
        </Link>
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

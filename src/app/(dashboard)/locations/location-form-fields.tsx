'use client';

import { useState } from 'react';
import { EntityCombobox, type ComboboxOption } from '@/components/entity-combobox';

type CreateAction = (
  formData: FormData
) => Promise<{ id: string; label: string } | { error: string }>;

const TYPE_OPTIONS = [
  { value: 'bail_meuble_annuel', label: 'Bail meublé annuel' },
  { value: 'bail_nu_annuel', label: 'Bail nu annuel' },
  { value: 'saisonnier_direct', label: 'Saisonnier — direct' },
  { value: 'saisonnier_plateforme', label: 'Saisonnier — plateforme' },
] as const;

const PERIODICITE_OPTIONS = [
  { value: 'forfait', label: 'Forfait' },
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'annee', label: 'Année' },
] as const;

interface DefaultValues {
  typeLocation?: string;
  periodicite?: string;
  dateDebut?: string;
  dateFin?: string;
  prixLocation?: string;
  depotGarantie?: string;
  chargesCourantes?: string;
  fraisMenage?: string;
  taxeSejour?: string;
  notes?: string;
}

interface Props {
  lotOptions: ComboboxOption[];
  customerOptions: ComboboxOption[];
  defaultLotId?: string;
  defaultCustomerId?: string;
  defaultValues?: DefaultValues;
  /** Server action to create a customer inline (passed from server parent). */
  createCustomerAction?: CreateAction;
}

export function LocationFormFields({
  lotOptions,
  customerOptions,
  defaultLotId,
  defaultCustomerId,
  defaultValues = {},
  createCustomerAction,
}: Props) {
  const [periodicite, setPeriodicite] = useState(defaultValues.periodicite ?? 'mois');

  const periodSuffix =
    periodicite === 'forfait'
      ? '(forfait)'
      : periodicite === 'jour'
      ? '/ jour'
      : periodicite === 'semaine'
      ? '/ semaine'
      : periodicite === 'mois'
      ? '/ mois'
      : '/ an';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Lot loué *</label>
          <EntityCombobox
            name="lotId"
            options={lotOptions}
            defaultValue={defaultLotId}
            placeholder="— Choisir un lot —"
            required
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Locataire *</label>
          <EntityCombobox
            name="customerId"
            options={customerOptions}
            defaultValue={defaultCustomerId}
            placeholder="— Choisir un locataire —"
            createLabel="+ Créer un nouveau locataire"
            createAction={createCustomerAction}
            createFields={['companyName', 'firstName', 'lastName', 'email', 'phone']}
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Type de location *</label>
        <select
          name="typeLocation"
          required
          defaultValue={defaultValues.typeLocation ?? 'bail_meuble_annuel'}
          className="input mt-1"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Date de début *</label>
          <input
            type="date"
            name="dateDebut"
            required
            defaultValue={defaultValues.dateDebut ?? ''}
            className="input mt-1"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Date de fin</label>
          <input
            type="date"
            name="dateFin"
            defaultValue={defaultValues.dateFin ?? ''}
            className="input mt-1"
          />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-md border border-zinc-200 bg-[#fbf8f0] p-4">
        <legend className="-ml-1 px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Loyer
        </legend>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">
            Périodicité :
          </span>
          {PERIODICITE_OPTIONS.map((p) => {
            const active = p.value === periodicite;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriodicite(p.value)}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-zinc-200 bg-[#fbf8f0] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <input type="hidden" name="periodicite" value={periodicite} />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">
            Loyer (€) {periodSuffix && <span className="text-zinc-400">{periodSuffix}</span>}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="prixLocation"
            defaultValue={defaultValues.prixLocation ?? ''}
            className="input mt-1 tnum"
            placeholder="Loyer hors charges"
          />
        </div>
      </fieldset>

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">
          Dépôt de garantie (€)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          name="depotGarantie"
          defaultValue={defaultValues.depotGarantie ?? ''}
          className="input mt-1 tnum"
          placeholder="ex : 2 mois de loyer"
        />
      </div>

      <fieldset className="space-y-3 rounded-md border border-zinc-200 bg-[#fbf8f0] p-4">
        <legend className="-ml-1 px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Charges
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ChargeRow
            label="Charges courantes"
            name="chargesCourantes"
            defaultValue={defaultValues.chargesCourantes}
          />
          <ChargeRow
            label="Frais ménage"
            name="fraisMenage"
            defaultValue={defaultValues.fraisMenage}
          />
          <ChargeRow
            label="Taxe séjour"
            name="taxeSejour"
            defaultValue={defaultValues.taxeSejour}
          />
        </div>
      </fieldset>

      <div>
        <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
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
    </div>
  );
}

function ChargeRow({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-zinc-600">{label}</label>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          step="0.01"
          min="0"
          name={name}
          defaultValue={defaultValue ?? ''}
          className="input tnum"
          placeholder="0,00"
        />
        <span className="text-[12px] text-zinc-500">€</span>
      </div>
    </div>
  );
}

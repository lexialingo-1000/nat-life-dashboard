'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { lookupSirenAction } from '@/app/(dashboard)/societes/actions';
import { normalizeSirenOrSiret } from '@/lib/recherche-entreprises';

const FORME_OPTIONS = [
  { value: 'sas', label: 'SAS' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sci', label: 'SCI' },
  { value: 'indivision', label: 'Indivision' },
  { value: 'eurl', label: 'EURL' },
  { value: 'sa', label: 'SA' },
  { value: 'auto_entrepreneur', label: 'Auto-entrepreneur' },
  { value: 'autre', label: 'Autre' },
];

// V1.11 R8 — enum 4 valeurs. NULL côté DB = info non renseignée.
export type TvaFrequency = 'non_assujettie' | 'mensuelle' | 'trimestrielle' | 'annuelle';

export interface SocieteFormValues {
  name?: string;
  siren?: string | null;
  type?: 'commerciale' | 'immobiliere';
  formeJuridique?: string | null;
  address?: string | null;
  activitePrincipale?: string | null;
  nafCode?: string | null;
  tvaIntracom?: string | null;
  // V1.11 R8 — fréquence TVA. Null = info non renseignée ; 'non_assujettie' = explicite.
  tvaFrequency?: TvaFrequency | null;
  isActive?: boolean;
}

interface Props {
  defaultValues?: SocieteFormValues;
  /** When true, displays an "Auto-fill from SIREN" button next to the SIREN field. */
  enableSirenLookup?: boolean;
  /** When true, displays the isActive toggle. */
  showActiveToggle?: boolean;
}

export function SocieteFormFields({
  defaultValues = {},
  enableSirenLookup = false,
  showActiveToggle = false,
}: Props) {
  const [siren, setSiren] = useState(defaultValues.siren ?? '');
  const [name, setName] = useState(defaultValues.name ?? '');
  const [type, setType] = useState<'commerciale' | 'immobiliere'>(
    defaultValues.type ?? 'commerciale',
  );
  const [formeJuridique, setFormeJuridique] = useState(defaultValues.formeJuridique ?? '');
  const [address, setAddress] = useState(defaultValues.address ?? '');
  const [activitePrincipale, setActivitePrincipale] = useState(
    defaultValues.activitePrincipale ?? '',
  );
  const [nafCode, setNafCode] = useState(defaultValues.nafCode ?? '');
  const [tvaIntracom, setTvaIntracom] = useState(defaultValues.tvaIntracom ?? '');
  // V1.11 R8 — checkbox pilote l'affichage du select fréquence. La valeur DB
  // est l'enum complet (1 colonne) ; "Assujettie" coché = mensuelle/trim/annuelle ;
  // décoché = non_assujettie.
  const initialAssujettie =
    defaultValues.tvaFrequency != null && defaultValues.tvaFrequency !== 'non_assujettie';
  const [isAssujettieTva, setIsAssujettieTva] = useState(initialAssujettie);
  const [tvaFrequency, setTvaFrequency] = useState<TvaFrequency | ''>(
    defaultValues.tvaFrequency && defaultValues.tvaFrequency !== 'non_assujettie'
      ? defaultValues.tvaFrequency
      : '',
  );
  const [isActive, setIsActive] = useState(defaultValues.isActive ?? true);

  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handleLookup = async () => {
    setLookupError(null);
    const normalized = normalizeSirenOrSiret(siren);
    if (!normalized) {
      setLookupError('Saisissez un numéro SIREN (9 chiffres) ou SIRET (14 chiffres).');
      return;
    }
    setLookupLoading(true);
    const fd = new FormData();
    fd.set('siren', normalized);
    const res = await lookupSirenAction(fd);
    setLookupLoading(false);
    if (res.error) {
      setLookupError(res.error);
      return;
    }
    if (res.data) {
      setSiren(res.data.siren);
      setName(res.data.name);
      setFormeJuridique(res.data.formeJuridique);
      setAddress(res.data.address ?? '');
      setActivitePrincipale(res.data.activitePrincipale ?? '');
      setNafCode(res.data.nafCode ?? '');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nom *</label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Type *</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'commerciale' | 'immobiliere')}
            required
            className="input mt-1"
          >
            <option value="commerciale">Commerciale</option>
            <option value="immobiliere">Immobilière</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Forme juridique</label>
          <select
            name="formeJuridique"
            value={formeJuridique}
            onChange={(e) => setFormeJuridique(e.target.value)}
            className="input mt-1"
          >
            <option value="">—</option>
            {FORME_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">SIREN ou SIRET</label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            name="siren"
            value={siren}
            onChange={(e) => setSiren(e.target.value)}
            className="input flex-1 font-mono text-sm"
            placeholder="123456789 (SIREN) ou 12345678900012 (SIRET)"
            maxLength={20}
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
          />
          {enableSirenLookup && (
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupLoading}
              className="btn-secondary whitespace-nowrap"
              title="Auto-remplir depuis l'API gouvernementale"
            >
              {lookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Auto-remplir
                </>
              )}
            </button>
          )}
        </div>
        {lookupError && <p className="mt-1 text-xs text-red-600">{lookupError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Adresse</label>
        <input
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Activité principale</label>
        <input
          name="activitePrincipale"
          value={activitePrincipale}
          onChange={(e) => setActivitePrincipale(e.target.value)}
          className="input mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Code NAF</label>
          <input
            type="text"
            name="nafCode"
            value={nafCode}
            onChange={(e) => setNafCode(e.target.value)}
            className="input mt-1 font-mono text-sm"
            placeholder="68.20B"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">N° TVA intracom</label>
          <input
            type="text"
            name="tvaIntracom"
            value={tvaIntracom}
            onChange={(e) => setTvaIntracom(e.target.value.toUpperCase())}
            className="input mt-1 font-mono text-sm"
            placeholder="FRXX123456789"
            maxLength={20}
          />
          <p className="mt-1 text-[11px] text-zinc-500">Format FR + 11 chiffres. Optionnel.</p>
        </div>
      </div>

      {/* V1.11 R8 — Assujettie à la TVA + fréquence (placé juste après N° TVA intracom). */}
      <div className="rounded-md border border-zinc-200 bg-[#fbf8f0] p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={isAssujettieTva}
            onChange={(e) => {
              setIsAssujettieTva(e.target.checked);
              if (!e.target.checked) setTvaFrequency('');
            }}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">Assujettie à la TVA</div>
            <p className="text-[11px] text-zinc-500">
              Si coché, choisissez la fréquence de déclaration.
            </p>
          </div>
        </label>
        {isAssujettieTva && (
          <div className="mt-3">
            <label className="block text-sm font-medium">Fréquence TVA *</label>
            <select
              name="tvaFrequency"
              value={tvaFrequency}
              onChange={(e) => setTvaFrequency(e.target.value as TvaFrequency | '')}
              required
              className="input mt-1"
            >
              <option value="">— Choisir —</option>
              <option value="mensuelle">TVA mensuelle</option>
              <option value="trimestrielle">TVA trimestrielle</option>
              <option value="annuelle">TVA annuelle</option>
            </select>
          </div>
        )}
        {!isAssujettieTva && <input type="hidden" name="tvaFrequency" value="non_assujettie" />}
      </div>

      {showActiveToggle && (
        <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <label htmlFor="isActive" className="text-sm">
            Société active
            <span className="ml-2 text-xs text-zinc-500">
              (décocher pour archiver sans supprimer)
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

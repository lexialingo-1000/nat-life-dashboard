'use client';

import { useState } from 'react';
import { lookupSirenAction, searchByNameAction, createSocieteAction } from '../actions';
import { Search, Loader2 } from 'lucide-react';
import type { CompanyLookupResult } from '@/lib/recherche-entreprises';

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

type Mode = 'siren' | 'name';

export default function NewSocietePage() {
  const [mode, setMode] = useState<Mode>('name');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CompanyLookupResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [siren, setSiren] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'commerciale' | 'immobiliere'>('commerciale');
  const [formeJuridique, setFormeJuridique] = useState('');
  const [address, setAddress] = useState('');
  const [activitePrincipale, setActivitePrincipale] = useState('');
  const [nafCode, setNafCode] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const applyResult = (r: CompanyLookupResult) => {
    setSiren(r.siren);
    setName(r.name);
    setFormeJuridique(r.formeJuridique);
    setAddress(r.address ?? '');
    setActivitePrincipale(r.activitePrincipale ?? '');
    setNafCode(r.nafCode ?? '');
    setSearchResults([]);
  };

  const handleSearch = async () => {
    setSearchError(null);
    setSearchResults([]);
    setSearching(true);

    const fd = new FormData();
    if (mode === 'siren') {
      const cleaned = search.replace(/\s/g, '');
      if (!/^\d{9}$/.test(cleaned)) {
        setSearchError('SIREN invalide (9 chiffres)');
        setSearching(false);
        return;
      }
      fd.set('siren', cleaned);
      const res = await lookupSirenAction(fd);
      setSearching(false);
      if (res.error) return setSearchError(res.error);
      if (res.data) applyResult(res.data);
    } else {
      if (search.trim().length < 2) {
        setSearchError('Saisis au moins 2 caractères');
        setSearching(false);
        return;
      }
      fd.set('query', search.trim());
      const res = await searchByNameAction(fd);
      setSearching(false);
      if (res.error) return setSearchError(res.error);
      if (res.data) {
        if (res.data.length === 1) {
          applyResult(res.data[0]);
        } else {
          setSearchResults(res.data);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const fd = new FormData(e.currentTarget);
    const res = await createSocieteAction(fd);
    if (res?.error) setSubmitError(res.error);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter une société</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recherche par nom ou SIREN — auto-fill des champs via l'API gouv.
        </p>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('name')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === 'name' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Par nom
          </button>
          <button
            type="button"
            onClick={() => setMode('siren')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === 'siren' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Par SIREN
          </button>
        </div>

        <label className="block text-sm font-medium">
          {mode === 'siren' ? 'SIREN (9 chiffres)' : 'Nom / raison sociale'}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
            className={`input flex-1 ${mode === 'siren' ? 'font-mono' : ''}`}
            placeholder={mode === 'siren' ? '123456789' : 'Plomberie Dupont'}
            maxLength={mode === 'siren' ? 11 : undefined}
          />
          <button type="button" onClick={handleSearch} disabled={searching} className="btn-secondary">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="mr-2 h-4 w-4" />Rechercher</>}
          </button>
        </div>
        {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} — clique pour pré-remplir
            </p>
            <ul className="space-y-1">
              {searchResults.map((r) => (
                <li key={r.siren}>
                  <button
                    type="button"
                    onClick={() => applyResult(r)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500">
                      SIREN <span className="font-mono">{r.siren}</span>
                      {r.activitePrincipale && ` · ${r.activitePrincipale}`}
                      {r.address && ` · ${r.address}`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <input type="hidden" name="siren" value={siren} />
        <input type="hidden" name="nafCode" value={nafCode} />

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
          <label className="block text-sm font-medium">Adresse</label>
          <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} className="input mt-1" />
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

        <div>
          <label className="block text-sm font-medium">Code NAF</label>
          <input
            type="text"
            value={nafCode}
            onChange={(e) => setNafCode(e.target.value)}
            className="input mt-1 font-mono text-sm"
            placeholder="68.20B"
          />
        </div>

        {submitError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{submitError}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <a href="/societes" className="btn-secondary">Annuler</a>
          <button type="submit" className="btn-primary">Créer la société</button>
        </div>
      </form>
    </div>
  );
}

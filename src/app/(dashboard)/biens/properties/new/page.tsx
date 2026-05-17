import { db } from '@/db/client';
import { companies } from '@/db/schema';
import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { BackLink } from '@/components/back-link';
import { createPropertyAction } from '../actions';

export const dynamic = 'force-dynamic';

// V12bis PR9 §4 — 4 statuts Natacha (dashboard-13). Loué/Vacant retirés —
// statut locatif vit sur le LOT.
const PROPERTY_STATUTS = [
  { value: 'en_cours_acquisition', label: "En cours d'acquisition" },
  { value: 'en_portefeuille', label: 'En portefeuille' },
  { value: 'en_cours_de_vente', label: 'En cours de vente' },
  { value: 'vendu', label: 'Vendu' },
] as const;

const PROPERTY_TYPES = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
  { value: 'garage', label: 'Garage' },
  { value: 'immeuble', label: 'Immeuble' },
  { value: 'terrain', label: 'Terrain' },
] as const;

export default async function NewPropertyPage() {
  const companyList = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .orderBy(asc(companies.name));

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref="/biens" label="Biens immobiliers" />

      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Patrimoine
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          Ajouter un Bien
        </h1>
      </div>

      <form action={createPropertyAction} className="card space-y-5 p-6" autoComplete="off">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              Nom du bien <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              className="input mt-1"
              placeholder="Ex: CABASSOLS, Appartement le Gauguin…"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Société <span className="text-red-500">*</span>
            </label>
            <select name="companyId" required className="input mt-1">
              <option value="">— Choisir —</option>
              {companyList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Type <span className="text-red-500">*</span>
            </label>
            <select name="type" required className="input mt-1" defaultValue="appartement">
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Statut <span className="text-red-500">*</span>
            </label>
            <select name="statut" required className="input mt-1" defaultValue="en_portefeuille">
              {PROPERTY_STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-700">Adresse</label>
            <input
              name="address"
              className="input mt-1"
              placeholder="18 Chemin Brunet"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Ville</label>
            <input
              name="city"
              className="input mt-1"
              placeholder="Aix-en-Provence"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Code postal</label>
            <input
              name="postalCode"
              className="input mt-1"
              placeholder="13090"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Date d'achat</label>
            <input name="purchaseDate" type="date" className="input mt-1" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Prix d'achat (€)</label>
            <input
              name="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              className="input mt-1 tabular-nums"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-700">Référence cadastrale</label>
            <input
              name="cadastre"
              className="input mt-1"
              placeholder="Ex: AB 123"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            className="input mt-1"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/biens" className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Créer le bien
          </button>
        </div>
      </form>
    </div>
  );
}

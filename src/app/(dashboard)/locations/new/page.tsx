import { db } from '@/db/client';
import { lots, properties, customers } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createLocationAction } from '../actions';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = [
  { value: 'bail_meuble_annuel', label: 'Bail meublé annuel' },
  { value: 'bail_nu_annuel', label: 'Bail nu annuel' },
  { value: 'saisonnier_direct', label: 'Saisonnier — direct' },
  { value: 'saisonnier_plateforme', label: 'Saisonnier — plateforme' },
];

const PERIODICITE_OPTIONS = [
  { value: 'forfait', label: 'Forfait' },
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'annee', label: 'Année' },
];

interface SearchParams {
  lotId?: string;
  customerId?: string;
  returnTo?: string;
}

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const lotRows = await db
    .select({
      id: lots.id,
      name: lots.name,
      propertyName: properties.name,
    })
    .from(lots)
    .innerJoin(properties, eq(lots.propertyId, properties.id))
    .orderBy(asc(properties.name), asc(lots.name));

  const customerRows = await db
    .select({
      id: customers.id,
      companyName: customers.companyName,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(customers)
    .where(eq(customers.isActive, true))
    .orderBy(asc(customers.companyName));

  const presetLotId = searchParams.lotId ?? '';
  const presetCustomerId = searchParams.customerId ?? '';
  const returnTo = searchParams.returnTo ?? '';

  const cancelHref =
    returnTo ||
    (presetLotId
      ? `/biens/lots/${presetLotId}`
      : presetCustomerId
      ? `/clients/${presetCustomerId}`
      : '/clients');

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        href={cancelHref}
        className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour
      </Link>

      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Nouvelle location
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Lier un client à un bien ou un lot</span>
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] text-zinc-500">
          La location établit la relation locative — bail annuel meublé/nu, saisonnier direct ou
          via plateforme. Les baux et états des lieux pourront être attachés via l'onglet
          Documents en V2.
        </p>
      </header>

      <form action={createLocationAction} className="card space-y-5 p-6">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Lot loué *</label>
            <select
              name="lotId"
              defaultValue={presetLotId}
              required
              className="input mt-1"
            >
              <option value="">— Choisir un lot —</option>
              {lotRows.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.propertyName} · {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Locataire *</label>
            <select
              name="customerId"
              defaultValue={presetCustomerId}
              required
              className="input mt-1"
            >
              <option value="">— Choisir un client —</option>
              {customerRows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName ||
                    `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
                    'client'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Type de location *
            </label>
            <select name="typeLocation" required className="input mt-1">
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Périodicité *</label>
            <select name="periodicite" defaultValue="mois" required className="input mt-1">
              {PERIODICITE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Date de début *</label>
            <input type="date" name="dateDebut" required className="input mt-1" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Date de fin</label>
            <input type="date" name="dateFin" className="input mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Prix location (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="prixLocation"
              className="input mt-1 tnum"
              placeholder="Loyer hors charges"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">Prix unitaire (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="prix"
              className="input mt-1 tnum"
              placeholder="Saisonnier nuit/sem"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700">
              Dépôt de garantie (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="depotGarantie"
              className="input mt-1 tnum"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700">Notes</label>
          <textarea name="notes" rows={3} className="input mt-1" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={cancelHref} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Créer la location
          </button>
        </div>
      </form>
    </div>
  );
}

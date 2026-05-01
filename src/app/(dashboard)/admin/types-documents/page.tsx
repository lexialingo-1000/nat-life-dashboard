import { db } from '@/db/client';
import { documentTypes } from '@/db/schema';
import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { createDocumentTypeAction, toggleActiveAction } from './actions';
import { Plus, Clock, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

const SCOPE_LABELS: Record<string, string> = {
  company: 'Société',
  supplier: 'Fournisseur',
  customer: 'Client',
  property: 'Immeuble',
  lot: 'Lot',
  marche: 'Marché',
  marche_lot: 'Sous-lot',
  location: 'Location',
};

const SCOPE_BADGE: Record<string, string> = {
  company: 'badge-emerald',
  supplier: 'badge-blue',
  customer: 'badge-emerald',
  property: 'badge-amber',
  lot: 'badge-amber',
  marche: 'badge-neutral',
  marche_lot: 'badge-neutral',
  location: 'badge-neutral',
};

const TENANT_LABELS: Record<string, string> = {
  LT: 'LT',
  CT: 'CT',
  all: 'Tous',
};

export default async function TypesDocumentsPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    rows = await db
      .select()
      .from(documentTypes)
      .orderBy(asc(documentTypes.scope), asc(documentTypes.sortOrder), asc(documentTypes.label));
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Administration
        </div>
        <h1 className="mt-1.5 text-[32px] font-normal leading-tight text-zinc-900">
          <span className="display-serif">Types de documents</span>
          <span className="ml-2 font-mono text-[13px] tnum text-zinc-400">{rows.length}</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-zinc-500">
          Catalogue extensible — ajoute, désactive ou crée des types pour les sociétés, fournisseurs,
          clients, biens et marchés. Les types marqués obligatoires alimentent le widget « Documents
          requis manquants » sur la fiche concernée. Les types avec date d'expiration alimentent le
          widget de vigilance.
        </p>
      </header>

      {dbError && (
        <div className="card p-6 text-[13px] text-emerald-700">
          Connexion DB indisponible : {dbError}
        </div>
      )}

      {!dbError && (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-[140px]">Scope</th>
                <th>Libellé</th>
                <th className="w-[180px]">Code</th>
                <th className="w-[110px]">Expiration</th>
                <th className="w-[110px]">Obligatoire</th>
                <th className="w-[100px]">Locataire</th>
                <th className="w-[90px]">Statut</th>
                <th className="w-[160px] text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t: any) => (
                <tr key={t.id}>
                  <td>
                    <span className={SCOPE_BADGE[t.scope] ?? 'badge-neutral'}>
                      {SCOPE_LABELS[t.scope] ?? t.scope}
                    </span>
                  </td>
                  <td className="font-medium text-zinc-900">{t.label}</td>
                  <td className="font-mono text-[12px] text-zinc-500">{t.code}</td>
                  <td>
                    {t.hasExpiration ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-emerald-700">
                        <Clock className="h-3 w-3" strokeWidth={2} />
                        Avec date
                      </span>
                    ) : (
                      <span className="text-[12px] text-zinc-400">—</span>
                    )}
                  </td>
                  <td>
                    {t.isRequired ? (
                      <span className="badge-amber">Obligatoire</span>
                    ) : (
                      <span className="text-[12px] text-zinc-400">—</span>
                    )}
                  </td>
                  <td>
                    {t.scope === 'customer' && t.appliesToTenantType ? (
                      <span className="badge-neutral">
                        {TENANT_LABELS[t.appliesToTenantType] ?? t.appliesToTenantType}
                      </span>
                    ) : (
                      <span className="text-[12px] text-zinc-400">—</span>
                    )}
                  </td>
                  <td>
                    {t.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-300" />
                        Désactivé
                      </span>
                    )}
                  </td>
                  <td className="text-right pr-5">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/admin/types-documents/${t.id}/edit`}
                        className="inline-flex items-center gap-1 text-[12px] text-emerald-700 hover:text-emerald-800"
                      >
                        <Pencil className="h-3 w-3" strokeWidth={2} />
                        Modifier
                      </Link>
                      <form action={toggleActiveAction} className="inline-block">
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="text-[12px] text-zinc-500 transition hover:text-emerald-700"
                        >
                          {t.isActive ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section>
        <div className="page-header mb-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
            Catalogue
          </div>
          <h2 className="mt-1.5 text-[20px] font-medium tracking-tight text-zinc-900">
            <span className="display-serif">Ajouter</span> un nouveau type
          </h2>
        </div>

        <form action={createDocumentTypeAction} className="card space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Code (slug)</label>
              <input
                name="code"
                required
                className="input mt-1 font-mono"
                placeholder="qualibat"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Minuscules, chiffres, underscores uniquement.
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Libellé</label>
              <input
                name="label"
                required
                className="input mt-1"
                placeholder="Attestation Qualibat"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">Scope</label>
              <select name="scope" required className="input mt-1" defaultValue="supplier">
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700">
                Type de locataire (scope client uniquement)
              </label>
              <select name="appliesToTenantType" className="input mt-1" defaultValue="">
                <option value="">— Non applicable / tous —</option>
                <option value="LT">Locataires LT (long terme)</option>
                <option value="CT">Locataires CT (court terme)</option>
                <option value="all">Tous les locataires</option>
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">
                Ignoré si le scope n'est pas « Client ».
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="hasExpiration"
                value="on"
                className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
              />
              <span>Document avec date d'expiration</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="isRequired"
                value="on"
                className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900"
              />
              <span>Document obligatoire (alimente le widget « manquants »)</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary">
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              Créer le type
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

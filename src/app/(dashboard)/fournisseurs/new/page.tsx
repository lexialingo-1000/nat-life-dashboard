import { createSupplierAction } from '../actions';

export default function NewFournisseurPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter un fournisseur</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Étape 1 — informations générales. Tu pourras ajouter contacts et documents (RC, décennale, KBis…) une fois le fournisseur créé.
        </p>
      </div>

      <form action={createSupplierAction} className="card space-y-4 p-6">
        <div>
          <label className="block text-sm font-medium">Raison sociale</label>
          <input name="companyName" className="input mt-1" placeholder="Plomberie Dupont SARL" />
          <p className="mt-1 text-xs text-zinc-500">
            Pour un artisan en nom propre, laisse vide et utilise prénom/nom.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Prénom</label>
            <input name="firstName" className="input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium">Nom</label>
            <input name="lastName" className="input mt-1" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Adresse</label>
          <input name="address" className="input mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input name="email" type="email" className="input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium">Téléphone</label>
            <input name="phone" className="input mt-1" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Mode de facturation</label>
          <select name="invoicingType" defaultValue="manual_upload" className="input mt-1">
            <option value="manual_upload">Upload manuel</option>
            <option value="email_forward">Email forwardé</option>
            <option value="pennylane">Pennylane (PA)</option>
            <option value="scraping_required">Scraping requis (V1.5)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Notes</label>
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
          <a href="/fournisseurs" className="btn-secondary">Annuler</a>
          <button type="submit" className="btn-primary">Créer le fournisseur</button>
        </div>
      </form>
    </div>
  );
}

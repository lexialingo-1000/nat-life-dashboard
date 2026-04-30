import { createCustomerAction } from '../actions';

interface SearchParams {
  returnTo?: string;
}

export default function NewClientPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const returnTo = searchParams.returnTo ?? '';
  const fromLocations = returnTo === '/locations';
  const cancelHref = fromLocations ? '/locations' : '/clients';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {fromLocations ? 'Ajouter un locataire' : 'Ajouter un client'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cette table couvre clients FKA (B2B) et locataires Valrose/KAPIMMO.
        </p>
      </div>

      <form action={createCustomerAction} className="card space-y-4 p-6">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <div>
          <label className="block text-sm font-medium">Raison sociale</label>
          <input name="companyName" className="input mt-1" />
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
          <a href={cancelHref} className="btn-secondary">Annuler</a>
          <button type="submit" className="btn-primary">
            {fromLocations ? 'Créer le locataire' : 'Créer le client'}
          </button>
        </div>
      </form>
    </div>
  );
}

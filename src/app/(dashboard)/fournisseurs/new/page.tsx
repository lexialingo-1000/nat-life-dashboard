import { FournisseurCreateForm } from '@/components/fournisseur-create-form';
import { createSupplierAction } from '../actions';
import { BackLink } from '@/components/back-link';

export default function NewFournisseurPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <BackLink fallbackHref="/fournisseurs" label="Fournisseurs" />

      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-700">
          Référentiel
        </div>
        <h1 className="mt-1.5 text-[28px] font-normal leading-tight text-zinc-900">
          Ajouter un fournisseur
        </h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Informations générales + contacts optionnels. Documents (RC, décennale, KBis…) à ajouter depuis la fiche.
        </p>
      </div>

      <FournisseurCreateForm action={createSupplierAction} />
    </div>
  );
}

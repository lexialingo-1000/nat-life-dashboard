'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createSocieteAction } from '../actions';
import { SocieteFormFields } from '@/components/societe-form-fields';

export default function NewSocietePage() {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const fd = new FormData(e.currentTarget);
    const res = await createSocieteAction(fd);
    if (res?.error) setSubmitError(res.error);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/societes"
        className="inline-flex items-center text-sm text-zinc-600 hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Sociétés
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter une société</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Renseigne les champs ci-dessous. Si tu connais le SIREN, le bouton « Auto-remplir »
          appelle l'API gouvernementale pour pré-remplir les autres champs.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <SocieteFormFields enableSirenLookup />

        {submitError && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{submitError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/societes" className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary">
            Créer la société
          </button>
        </div>
      </form>
    </div>
  );
}

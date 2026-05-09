'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';

interface Contact {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  fonction: string;
}

const emptyContact = (): Contact => ({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  fonction: '',
});

interface Props {
  action: (formData: FormData) => Promise<void>;
}

export function FournisseurCreateForm({ action }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  const addContact = () => setContacts((prev) => [...prev, emptyContact()]);

  const removeContact = (i: number) =>
    setContacts((prev) => prev.filter((_, idx) => idx !== i));

  const updateContact = (i: number, field: keyof Contact, value: string) =>
    setContacts((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
    );

  return (
    <form action={action} className="card space-y-5 p-6">
      <input type="hidden" name="contactCount" value={contacts.length} />

      {/* Identité fournisseur */}
      <div>
        <label className="block text-sm font-medium">Raison sociale</label>
        <input
          name="companyName"
          className="input mt-1"
          placeholder="Plomberie Dupont SARL"
        />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Type de fournisseur</label>
          <select name="type" defaultValue="autre" className="input mt-1">
            <option value="notaire">Notaire</option>
            <option value="banque">Banque</option>
            <option value="juridique">Juridique</option>
            <option value="comptabilite">Comptabilité</option>
            <option value="architecte">Architecte</option>
            <option value="entrepreneur">Entrepreneur</option>
            <option value="syndic">Syndic</option>
            <option value="diagnostic">Diagnostic</option>
            <option value="assurance">Assurance</option>
            <option value="autre">Autre</option>
          </select>
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

      {/* Section Contacts */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-700">
            Contacts{contacts.length > 0 ? ` (${contacts.length})` : ''}
          </h3>
          <button
            type="button"
            onClick={addContact}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Ajouter un contact
          </button>
        </div>

        {contacts.length === 0 && (
          <p className="text-xs text-zinc-400">
            Pas de contact pour l'instant. Tu pourras en ajouter ici ou depuis la fiche fournisseur.
          </p>
        )}

        {contacts.map((c, i) => (
          <div key={i} className="mb-3 rounded-md border border-zinc-200 bg-white p-3">
            {/* Hidden fields pour la server action */}
            <input type="hidden" name={`contact_${i}_firstName`} value={c.firstName} />
            <input type="hidden" name={`contact_${i}_lastName`} value={c.lastName} />
            <input type="hidden" name={`contact_${i}_phone`} value={c.phone} />
            <input type="hidden" name={`contact_${i}_email`} value={c.email} />
            <input type="hidden" name={`contact_${i}_fonction`} value={c.fonction} />

            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600">Contact {i + 1}</span>
              <button
                type="button"
                onClick={() => removeContact(i)}
                className="text-zinc-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-600">Prénom</label>
                <input
                  className="input mt-0.5 text-sm"
                  value={c.firstName}
                  onChange={(e) => updateContact(i, 'firstName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600">Nom</label>
                <input
                  className="input mt-0.5 text-sm"
                  value={c.lastName}
                  onChange={(e) => updateContact(i, 'lastName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600">Téléphone</label>
                <input
                  className="input mt-0.5 text-sm"
                  type="tel"
                  value={c.phone}
                  onChange={(e) => updateContact(i, 'phone', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600">Email</label>
                <input
                  className="input mt-0.5 text-sm"
                  type="email"
                  value={c.email}
                  onChange={(e) => updateContact(i, 'email', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-600">Fonction / Rôle</label>
                <input
                  className="input mt-0.5 text-sm"
                  placeholder="Ex: Commercial, Responsable chantier…"
                  value={c.fonction}
                  onChange={(e) => updateContact(i, 'fonction', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href="/fournisseurs" className="btn-secondary">
          Annuler
        </Link>
        <button type="submit" className="btn-primary">
          Créer le fournisseur
        </button>
      </div>
    </form>
  );
}

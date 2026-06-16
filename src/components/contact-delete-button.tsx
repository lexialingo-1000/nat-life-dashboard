'use client';

import { useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface Props {
  action: (formData: FormData) => Promise<void>;
  contactId: string;
  supplierId: string;
  contactLabel: string;
}

export function ContactDeleteButton({ action, contactId, supplierId, contactLabel }: Props) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm(`Supprimer le contact "${contactLabel}" ? Cette action est irréversible.`)) {
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set('contactId', contactId);
      fd.set('supplierId', supplierId);
      await action(fd);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={`Supprimer ${contactLabel}`}
      className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

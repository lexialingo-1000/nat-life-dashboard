// Régression : modifier un marché remettait son statut à « signé » (pas de champ status dans le formulaire).
// Lancer depuis dashboard/ : npx tsx tests/check-marche-form-status.tsx
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as { React?: typeof React }).React = React; // tsconfig jsx=preserve : tsx compile en JSX classique

(async () => {
  const { MarcheForm } = await import('@/components/marche-form');
  const html = renderToStaticMarkup(
    <MarcheForm
      action={async () => {}}
      propertyId="p1"
      propertyName="Bien"
      lots={[]}
      suppliers={[]}
      marcheTypes={[]}
      defaultValues={{ id: 'm1', status: 'en_cours' }}
      cancelHref="/marches/m1"
      submitLabel="Enregistrer"
    />,
  );
  const input = html.match(/<input[^>]*name="status"[^>]*>/)?.[0];
  if (!input?.includes('value="en_cours"')) {
    console.error("ÉCHEC : le statut du marché n'est pas renvoyé par le formulaire", input ?? '(aucun champ status)');
    process.exit(1);
  }
  console.log('OK :', input);
})();

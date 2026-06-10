// dashboard-22 (retour Natacha §APP — « si je veux ouvrir un PLAN il ne se passe rien »).
//
// Piège iOS Safari / PWA : ouvrir un nouvel onglet n'est autorisé que DANS le
// geste utilisateur synchrone. Le pattern précédent (`await getUrl()` puis
// `<a target="_blank">.click()`) déclenche l'ouverture APRÈS l'await → le geste
// est déjà consommé → l'onglet est bloqué silencieusement = « rien ne se passe ».
// Les gros fichiers (plans) rendent le round-trip presigned plus lent, donc le
// blocage est quasi systématique sur eux, alors qu'un petit doc « aboutit » parfois.
//
// Fix : ouvrir l'onglet AVANT l'await (`window.open('about:blank')`, dans le
// geste), puis y poser l'URL signée une fois résolue. Fallback ancre si le popup
// est totalement désactivé.

type SignedUrlResult = { url: string } | { error: string };

export async function openSignedUrl(getUrl: () => Promise<SignedUrlResult>): Promise<void> {
  // Ouvre l'onglet dans le geste courant (synchrone, avant tout await).
  const win = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;

  let res: SignedUrlResult;
  try {
    res = await getUrl();
  } catch (e) {
    if (win && !win.closed) win.close();
    throw e;
  }

  if ('url' in res) {
    if (win && !win.closed) {
      // Coupe la référence opener (anti reverse-tabnabbing) puis navigue.
      try {
        (win as Window).opener = null;
      } catch {
        // certains navigateurs interdisent l'écriture : sans gravité ici.
      }
      win.location.replace(res.url);
    } else {
      // Popup entièrement bloqué : meilleure effort via une ancre (même geste).
      const a = document.createElement('a');
      a.href = res.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } else {
    if (win && !win.closed) win.close();
    alert(`Erreur ouverture : ${res.error}`);
  }
}

/**
 * Chemin de retour après un formulaire : seulement un chemin interne (`/…`), jamais
 * `//hote`, `/\\hote`, une URL absolue ni un caractère de contrôle (`/\t/hote` devient
 * `//hote` une fois l'URL analysée) : pas de redirection ouverte. Sinon `fallback`.
 */
export function safeReturnTo(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value : '';
  if (
    !v.startsWith('/') ||
    v.startsWith('//') ||
    v.startsWith('/\\') ||
    /[\x00-\x1f\x7f]/.test(v)
  ) {
    return fallback;
  }
  return v;
}

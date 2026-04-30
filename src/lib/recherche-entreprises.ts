/**
 * Wrapper autour de l'API gouvernementale recherche-entreprises.api.gouv.fr.
 * Permet l'auto-remplissage des champs companies à la création depuis l'UI.
 *
 * Doc API : https://recherche-entreprises.api.gouv.fr/docs
 * Gratuit, sans clé.
 */

const API_URL = process.env.RECHERCHE_ENTREPRISES_API ?? 'https://recherche-entreprises.api.gouv.fr/search';

interface ApiResult {
  siren: string;
  nom_complet: string;
  nom_raison_sociale: string | null;
  sigle: string | null;
  nature_juridique: string | null;
  activite_principale: string | null;
  siege: {
    adresse: string | null;
    code_postal: string | null;
    libelle_commune: string | null;
  } | null;
}

export interface CompanyLookupResult {
  siren: string;
  name: string;
  formeJuridique: 'sas' | 'sarl' | 'sci' | 'eurl' | 'sa' | 'auto_entrepreneur' | 'autre';
  address: string | null;
  activitePrincipale: string | null;
  nafCode: string | null;
}

/**
 * Mapping codes nature juridique INSEE → enum Drizzle.
 * Ref : https://www.insee.fr/fr/information/2028129
 */
function mapFormeJuridique(natureJuridique: string | null): CompanyLookupResult['formeJuridique'] {
  if (!natureJuridique) return 'autre';
  const code = natureJuridique.substring(0, 4);
  if (code.startsWith('57')) return 'sas';
  if (code.startsWith('54') || code === '5499') return 'sarl';
  if (code.startsWith('65')) return 'sci';
  if (code.startsWith('5430') || code === '5499') return 'eurl';
  if (code.startsWith('55')) return 'sa';
  if (code.startsWith('10')) return 'auto_entrepreneur';
  return 'autre';
}

function toResult(r: ApiResult): CompanyLookupResult {
  return {
    siren: r.siren,
    name: r.nom_raison_sociale ?? r.nom_complet,
    formeJuridique: mapFormeJuridique(r.nature_juridique),
    address: r.siege?.adresse ?? null,
    activitePrincipale: r.activite_principale ?? null,
    nafCode: r.activite_principale,
  };
}

/**
 * Accepte SIREN (9 chiffres) ou SIRET (14 chiffres). Si SIRET, on extrait
 * le SIREN (premiers 9 chiffres) pour interroger l'API gouv. Espaces ignorés.
 */
export function normalizeSirenOrSiret(input: string): string | null {
  const cleaned = input.replace(/[\s.\-]/g, '');
  if (/^\d{14}$/.test(cleaned)) return cleaned.slice(0, 9);
  if (/^\d{9}$/.test(cleaned)) return cleaned;
  return null;
}

export async function lookupBySiren(siren: string): Promise<CompanyLookupResult | null> {
  const cleaned = normalizeSirenOrSiret(siren);
  if (!cleaned) {
    throw new Error('Saisissez un numéro SIREN (9 chiffres) ou SIRET (14 chiffres).');
  }

  const response = await fetch(`${API_URL}?q=${cleaned}`);
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API gouv : quota atteint, réessayer dans quelques secondes');
    }
    throw new Error(`API gouv : erreur ${response.status}`);
  }

  const data = (await response.json()) as { results: ApiResult[] };
  if (!data.results || data.results.length === 0) {
    return null;
  }
  return toResult(data.results[0]);
}

/**
 * Recherche par nom (raison sociale ou dénomination).
 * Retourne jusqu'à 10 résultats pour permettre à l'utilisateur de choisir.
 */
export async function searchByName(query: string): Promise<CompanyLookupResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const response = await fetch(`${API_URL}?q=${encodeURIComponent(trimmed)}&per_page=10`);
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API gouv : quota atteint, réessayer dans quelques secondes');
    }
    throw new Error(`API gouv : erreur ${response.status}`);
  }
  const data = (await response.json()) as { results: ApiResult[] };
  return (data.results ?? []).map(toResult);
}

/* eslint-disable no-console */
/**
 * Logger applicatif minimal — point d'entrée unique pour les logs serveur.
 *
 * Préfixe chaque ligne d'un horodatage ISO + niveau. Centralise les `console.*`
 * éparpillés afin de pouvoir, plus tard, brancher un transport (Sentry, etc.)
 * ou couper les logs verbeux en prod sans toucher aux call sites.
 *
 * NB : les scripts CLI (`db/seed.ts`, `db/migrate.ts`) gardent `console.*`
 * volontairement — ce sont des sorties terminal, pas des logs applicatifs.
 */
type LogArgs = readonly unknown[];

function stamp(level: string): string {
  return `${new Date().toISOString()} [${level}]`;
}

export const logger = {
  error(...args: LogArgs): void {
    console.error(stamp('error'), ...args);
  },
  warn(...args: LogArgs): void {
    console.warn(stamp('warn'), ...args);
  },
  info(...args: LogArgs): void {
    console.log(stamp('info'), ...args);
  },
};

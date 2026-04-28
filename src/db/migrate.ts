import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('[migrate] applying migrations...');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('[migrate] done.');

  await sql.end();
}

main().catch((err) => {
  console.error('[migrate] FAILED', err);
  process.exit(1);
});

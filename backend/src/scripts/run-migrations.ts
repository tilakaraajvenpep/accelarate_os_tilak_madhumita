import 'dotenv/config'
import path from 'path'
import { readFileSync } from 'fs'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { loadSecrets } from '../config/load-secrets'

/**
 * `drizzle-kit migrate` only reads DATABASE_URL from .env — in this project
 * that value lives in AWS Secrets Manager and is loaded into process.env at
 * server boot (see server.ts), so the CLI never sees it. This script mirrors
 * that same bootstrap before running the migration.
 */
async function main() {
  await loadSecrets()

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL was not resolved from secrets')

  const isRds = connectionString.includes('rds.amazonaws.com')
  const pool = new Pool({
    connectionString,
    ssl: isRds
      ? { ca: readFileSync(path.join(__dirname, '../../certs/rds-combined-ca-bundle.pem'), 'utf8') }
      : undefined,
  })

  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') })
  console.log('Migrations applied successfully.')
  await pool.end()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

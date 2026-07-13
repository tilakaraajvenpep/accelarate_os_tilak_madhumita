import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

/**
 * Seeds a super_admin account for AOS-v2. See seed-superadmin.impl.ts for the
 * actual logic — this file just loads config from Secrets Manager first
 * (loadSecrets populates process.env before the impl module's top-level
 * consts read COGNITO_USER_POOL_ID / DATABASE_URL).
 *
 * Run:  npm run seed:superadmin
 */
async function bootstrap() {
  await loadSecrets()
  const { main } = await import('./seed-superadmin.impl')
  return main()
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })

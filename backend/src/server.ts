import 'dotenv/config'
import { loadSecrets } from './config/load-secrets'

async function main() {
  await loadSecrets()
  const { default: app } = await import('./app')

  const PORT = Number(process.env.PORT) || 3000
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('[server] failed to start:', err)
  process.exit(1)
})

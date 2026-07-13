import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

/**
 * Pulls backend config from AWS Secrets Manager into process.env before the
 * rest of the app boots. Secret name comes from SECRETS_NAME (falls back to
 * plain .env / already-set process.env vars if unset, e.g. for CI unit tests).
 */
export async function loadSecrets(): Promise<void> {
  const secretName = process.env.SECRETS_NAME
  if (!secretName) return

  const region = process.env.AWS_REGION || 'ap-southeast-1'
  const client = new SecretsManagerClient({ region })
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretName }))
  if (!result.SecretString) throw new Error(`Secret ${secretName} has no string value`)

  const values = JSON.parse(result.SecretString) as Record<string, string>
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

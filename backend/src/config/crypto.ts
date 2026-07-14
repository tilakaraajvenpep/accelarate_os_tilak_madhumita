import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const b64 = process.env.CONFIG_ENCRYPTION_KEY
  if (!b64) {
    throw new Error('CONFIG_ENCRYPTION_KEY is not set in the environment (Secrets Manager)')
  }
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) {
    throw new Error('CONFIG_ENCRYPTION_KEY must decode to 32 bytes (AES-256)')
  }
  return key
}

/** Encrypts a secret value for storage. Returns "iv:authTag:ciphertext" as base64 segments. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptSecret(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted secret')
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

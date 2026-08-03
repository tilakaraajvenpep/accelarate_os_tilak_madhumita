import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants } from '../models'
import { getPlatformSettings } from './platform-settings.service'

export class InsufficientCreditsError extends Error {
  constructor(message = 'Your organization is out of AI credits. Contact your admin to recharge.') {
    super(message)
  }
}

export async function hasAvailableCredits(tenantId: number): Promise<boolean> {
  const [tenant] = await db.select({ balance: tenants.aiCreditsBalance }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  return (tenant?.balance ?? 0) > 0
}

/** Converts real OpenAI token usage into a credit cost and deducts it — allowed to go
 * negative, since the response was already generated/delivered before the cost is known;
 * it's the *next* call that gets blocked by hasAvailableCredits, not this one. */
export async function spendAiCredits(tenantId: number, totalTokens: number): Promise<void> {
  const settings = await getPlatformSettings()
  const creditsToSpend = Math.max(1, Math.ceil((totalTokens / 1000) * settings.aiCreditsPerThousandTokens))

  await db
    .update(tenants)
    .set({ aiCreditsBalance: sql`${tenants.aiCreditsBalance} - ${creditsToSpend}`, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
}

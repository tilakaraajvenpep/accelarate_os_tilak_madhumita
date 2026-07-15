import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { platformSettings } from '../models'

export async function getPlatformSettings() {
  const [row] = await db.select().from(platformSettings).limit(1)
  if (row) return row
  const [created] = await db.insert(platformSettings).values({}).returning()
  return created
}

export async function setAiCreditRateCents(cents: number) {
  const settings = await getPlatformSettings()
  const [updated] = await db
    .update(platformSettings)
    .set({ aiCreditRateCents: cents, updatedAt: new Date() })
    .where(eq(platformSettings.id, settings.id))
    .returning()
  return updated
}

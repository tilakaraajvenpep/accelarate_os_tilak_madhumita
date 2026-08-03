import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { pillarFounderNotes } from '../models'

export async function getPillarNote(tenantId: number, companyId: number, pillarId: number) {
  const [note] = await db
    .select()
    .from(pillarFounderNotes)
    .where(and(eq(pillarFounderNotes.tenantId, tenantId), eq(pillarFounderNotes.companyId, companyId), eq(pillarFounderNotes.pillarId, pillarId)))
    .limit(1)
  return note ?? null
}

export async function savePillarNote(tenantId: number, companyId: number, pillarId: number, keyTakeaways: string) {
  const existing = await getPillarNote(tenantId, companyId, pillarId)
  if (existing) {
    const [updated] = await db
      .update(pillarFounderNotes)
      .set({ keyTakeaways, updatedAt: new Date() })
      .where(eq(pillarFounderNotes.id, existing.id))
      .returning()
    return updated
  }
  const [created] = await db.insert(pillarFounderNotes).values({ tenantId, companyId, pillarId, keyTakeaways }).returning()
  return created
}

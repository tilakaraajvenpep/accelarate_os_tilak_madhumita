import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { pillarMaterials, users } from '../models'

/** Metadata only (no fileData) — the list view shouldn't pull every material's full base64 payload. */
export async function listPillarMaterials(tenantId: number, companyId: number, pillarId: number) {
  return db
    .select({
      id: pillarMaterials.id,
      title: pillarMaterials.title,
      fileName: pillarMaterials.fileName,
      fileType: pillarMaterials.fileType,
      fileSize: pillarMaterials.fileSize,
      uploadedByUserId: pillarMaterials.uploadedByUserId,
      uploadedByName: users.name,
      createdAt: pillarMaterials.createdAt,
    })
    .from(pillarMaterials)
    .innerJoin(users, eq(users.id, pillarMaterials.uploadedByUserId))
    .where(and(eq(pillarMaterials.tenantId, tenantId), eq(pillarMaterials.companyId, companyId), eq(pillarMaterials.pillarId, pillarId)))
    .orderBy(desc(pillarMaterials.createdAt))
}

/** Single material including its fileData — fetched on demand for download. */
export async function getPillarMaterial(tenantId: number, id: number) {
  const [material] = await db.select().from(pillarMaterials).where(and(eq(pillarMaterials.id, id), eq(pillarMaterials.tenantId, tenantId))).limit(1)
  return material ?? null
}

export async function uploadPillarMaterial(params: {
  tenantId: number
  companyId: number
  pillarId: number
  title: string
  fileName: string
  fileType: string
  fileData: string
  fileSize: number
  uploadedByUserId: number
}) {
  const [created] = await db.insert(pillarMaterials).values(params).returning()
  return created
}

export async function deletePillarMaterial(tenantId: number, id: number, requestingUserId: number) {
  const material = await getPillarMaterial(tenantId, id)
  if (!material) throw new Error('Material not found')
  if (material.uploadedByUserId !== requestingUserId) throw new Error('You can only delete materials you uploaded')
  await db.delete(pillarMaterials).where(eq(pillarMaterials.id, id))
}

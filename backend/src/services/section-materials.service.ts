import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { sectionMaterials, users } from '../models'

/** Metadata only (no fileData) — the list view shouldn't pull every material's full base64 payload. */
export async function listSectionMaterials(tenantId: number, companyId: number, sectionId: number) {
  return db
    .select({
      id: sectionMaterials.id,
      title: sectionMaterials.title,
      fileName: sectionMaterials.fileName,
      fileType: sectionMaterials.fileType,
      fileSize: sectionMaterials.fileSize,
      uploadedByUserId: sectionMaterials.uploadedByUserId,
      uploadedByName: users.name,
      createdAt: sectionMaterials.createdAt,
    })
    .from(sectionMaterials)
    .innerJoin(users, eq(users.id, sectionMaterials.uploadedByUserId))
    .where(and(eq(sectionMaterials.tenantId, tenantId), eq(sectionMaterials.companyId, companyId), eq(sectionMaterials.sectionId, sectionId)))
    .orderBy(desc(sectionMaterials.createdAt))
}

/** Single material including its fileData — fetched on demand for download. */
export async function getSectionMaterial(tenantId: number, id: number) {
  const [material] = await db.select().from(sectionMaterials).where(and(eq(sectionMaterials.id, id), eq(sectionMaterials.tenantId, tenantId))).limit(1)
  return material ?? null
}

export async function uploadSectionMaterial(params: {
  tenantId: number
  companyId: number
  sectionId: number
  title: string
  fileName: string
  fileType: string
  fileData: string
  fileSize: number
  uploadedByUserId: number
}) {
  const [created] = await db.insert(sectionMaterials).values(params).returning()
  return created
}

export async function deleteSectionMaterial(tenantId: number, id: number, requestingUserId: number) {
  const material = await getSectionMaterial(tenantId, id)
  if (!material) throw new Error('Material not found')
  if (material.uploadedByUserId !== requestingUserId) throw new Error('You can only delete materials you uploaded')
  await db.delete(sectionMaterials).where(eq(sectionMaterials.id, id))
}

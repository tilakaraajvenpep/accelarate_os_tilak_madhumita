import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortDocuments, users } from '../models'

export const MAX_DOCUMENT_FILE_BYTES = 8_000_000

/** Metadata only (no fileData) — the list view shouldn't pull every document's full base64 payload. */
export async function listCohortDocuments(tenantId: number, cohortId: number) {
  return db
    .select({
      id: cohortDocuments.id,
      title: cohortDocuments.title,
      fileName: cohortDocuments.fileName,
      fileType: cohortDocuments.fileType,
      fileSize: cohortDocuments.fileSize,
      uploadedByUserId: cohortDocuments.uploadedByUserId,
      uploadedByName: users.name,
      createdAt: cohortDocuments.createdAt,
    })
    .from(cohortDocuments)
    .innerJoin(users, eq(users.id, cohortDocuments.uploadedByUserId))
    .where(and(eq(cohortDocuments.tenantId, tenantId), eq(cohortDocuments.cohortId, cohortId)))
    .orderBy(desc(cohortDocuments.createdAt))
}

/** Single document including its fileData — fetched on demand for download/preview. */
export async function getCohortDocument(tenantId: number, id: number) {
  const [doc] = await db.select().from(cohortDocuments).where(and(eq(cohortDocuments.id, id), eq(cohortDocuments.tenantId, tenantId))).limit(1)
  return doc ?? null
}

export async function uploadCohortDocument(params: {
  tenantId: number
  cohortId: number
  title: string
  fileName: string
  fileType: string
  fileData: string
  fileSize: number
  uploadedByUserId: number
}) {
  const [created] = await db.insert(cohortDocuments).values(params).returning()
  return created
}

export async function deleteCohortDocument(tenantId: number, id: number, requestingUserId: number, canDeleteAny: boolean) {
  const doc = await getCohortDocument(tenantId, id)
  if (!doc) throw new Error('Document not found')
  if (!canDeleteAny && doc.uploadedByUserId !== requestingUserId) throw new Error('You can only delete documents you uploaded')
  await db.delete(cohortDocuments).where(eq(cohortDocuments.id, id))
}

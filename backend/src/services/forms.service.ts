import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { forms, type SimpleFormQuestion } from '../models'

export async function listForms(tenantId: number) {
  return db.select().from(forms).where(eq(forms.tenantId, tenantId)).orderBy(asc(forms.name))
}

export async function createForm(params: {
  tenantId: number
  name: string
  status: 'active' | 'inactive'
  schema?: SimpleFormQuestion[]
}) {
  const [created] = await db
    .insert(forms)
    .values({ tenantId: params.tenantId, name: params.name, status: params.status, schema: params.schema ?? [] })
    .returning()
  return created
}

export async function updateForm(
  tenantId: number,
  id: number,
  data: Partial<{ name: string; status: 'active' | 'inactive'; schema: SimpleFormQuestion[] }>,
) {
  const [updated] = await db
    .update(forms)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(forms.id, id), eq(forms.tenantId, tenantId)))
    .returning()
  if (!updated) throw new Error('Form not found')
  return updated
}

export async function deleteForm(tenantId: number, id: number) {
  const [deleted] = await db.delete(forms).where(and(eq(forms.id, id), eq(forms.tenantId, tenantId))).returning()
  if (!deleted) throw new Error('Form not found')
  return deleted
}

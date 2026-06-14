import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../models'

export async function upsertUser(data: {
  cognitoSub: string
  email: string
  name?: string | null
}) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, data.cognitoSub))
    .limit(1)

  if (existing.length > 0) {
    if (data.name && data.name !== existing[0].name) {
      const [updated] = await db
        .update(users)
        .set({ name: data.name, updatedAt: new Date() })
        .where(eq(users.cognitoSub, data.cognitoSub))
        .returning()
      return updated
    }
    return existing[0]
  }

  const [created] = await db
    .insert(users)
    .values({
      cognitoSub: data.cognitoSub,
      email: data.email,
      name: data.name ?? null,
      role: 'founder',
    })
    .returning()

  return created
}

export async function getUserBySub(sub: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, sub))
    .limit(1)
  return user ?? null
}

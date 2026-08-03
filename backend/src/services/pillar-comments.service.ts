import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { pillarComments, users, companyMembers } from '../models'

export async function listPillarComments(tenantId: number, companyId: number, pillarId: number) {
  const [firstMember] = await db
    .select({ userId: companyMembers.userId })
    .from(companyMembers)
    .where(eq(companyMembers.companyId, companyId))
    .orderBy(companyMembers.createdAt)
    .limit(1)

  const comments = await db
    .select({
      id: pillarComments.id,
      body: pillarComments.body,
      authorUserId: pillarComments.authorUserId,
      authorRole: pillarComments.authorRole,
      authorName: users.name,
      createdAt: pillarComments.createdAt,
    })
    .from(pillarComments)
    .innerJoin(users, eq(users.id, pillarComments.authorUserId))
    .where(and(eq(pillarComments.tenantId, tenantId), eq(pillarComments.companyId, companyId), eq(pillarComments.pillarId, pillarId)))
    .orderBy(asc(pillarComments.createdAt))

  return comments.map((comment) => {
    let role = comment.authorRole
    if (role === 'founder' && firstMember && comment.authorUserId !== firstMember.userId) {
      role = 'co-founder'
    }
    return {
      ...comment,
      authorRole: role,
    }
  })
}

export async function addPillarComment(params: {
  tenantId: number
  companyId: number
  pillarId: number
  authorUserId: number
  authorRole: 'founder' | 'co-founder' | 'mentor'
  body: string
}) {
  const [created] = await db.insert(pillarComments).values(params).returning()
  return created
}

import { Router, Response } from 'express'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  getRevenueTrend,
  getCreditRevenueTrend,
  getSubscriptionBreakdown,
  getTenantGrowth,
  getCouponPerformance,
  getTransactions,
} from '../services/reports.service'

const router = Router()

router.use(requireAuth, loadUser, requireRole('super_admin'))

function monthsParam(req: AuthRequest): number {
  const raw = Number(req.query.months)
  if (!Number.isFinite(raw) || raw <= 0) return 12
  return Math.min(raw, 36)
}

router.get('/revenue', async (req: AuthRequest, res: Response) => {
  res.json(await getRevenueTrend(monthsParam(req)))
})

router.get('/credits', async (req: AuthRequest, res: Response) => {
  res.json(await getCreditRevenueTrend(monthsParam(req)))
})

router.get('/subscriptions', async (_req: AuthRequest, res: Response) => {
  res.json(await getSubscriptionBreakdown())
})

router.get('/tenant-growth', async (req: AuthRequest, res: Response) => {
  res.json(await getTenantGrowth(monthsParam(req)))
})

router.get('/coupons', async (_req: AuthRequest, res: Response) => {
  res.json(await getCouponPerformance())
})

router.get('/transactions', async (req: AuthRequest, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  res.json(await getTransactions({ limit, offset }))
})

export default router

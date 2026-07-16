import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DollarSign, Zap, Users2, Ticket, type LucideIcon } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts'
import { api } from '@/lib/api'
import { useChartPalette } from '@/lib/chart-palette'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type {
  MonthlySeriesPoint, SubscriptionBreakdown, TenantGrowthPoint, CouponPerformance, TransactionRow,
} from '@/types/reports'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatMonth(month: string) {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function pivotByMethod(rows: MonthlySeriesPoint[]) {
  const map = new Map<string, { month: string; online: number; offline: number }>()
  for (const r of rows) {
    if (!map.has(r.month)) map.set(r.month, { month: r.month, online: 0, offline: 0 })
    const entry = map.get(r.month)!
    if (r.method === 'stripe') entry.online += r.totalCents
    else entry.offline += r.totalCents
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month))
}

/** Caps a categorical series list at the palette's usable slot count, folding the
 * rest into "Other" — never cycles hues past the fixed order. */
function capToOther<T extends { count: number }>(rows: T[], nameOf: (r: T) => string, max: number) {
  const sorted = [...rows].sort((a, b) => b.count - a.count)
  const head = sorted.slice(0, max)
  const rest = sorted.slice(max)
  const otherCount = rest.reduce((sum, r) => sum + r.count, 0)
  const out = head.map((r) => ({ name: nameOf(r), count: r.count }))
  if (otherCount > 0) out.push({ name: 'Other', count: otherCount })
  return out
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  )
}

export default function ReportsPage() {
  const { t } = useTranslation('superadminReports')
  const palette = useChartPalette()
  const [transactionsPage, setTransactionsPage] = useState(0)
  const pageSize = 20

  const { data: revenue = [] } = useQuery({
    queryKey: ['reports-revenue'],
    queryFn: async () => (await api.get<MonthlySeriesPoint[]>('/api/reports/revenue?months=12')).data,
  })
  const { data: credits = [] } = useQuery({
    queryKey: ['reports-credits'],
    queryFn: async () => (await api.get<MonthlySeriesPoint[]>('/api/reports/credits?months=12')).data,
  })
  const { data: subs } = useQuery({
    queryKey: ['reports-subscriptions'],
    queryFn: async () => (await api.get<SubscriptionBreakdown>('/api/reports/subscriptions')).data,
  })
  const { data: tenantGrowth = [] } = useQuery({
    queryKey: ['reports-tenant-growth'],
    queryFn: async () => (await api.get<TenantGrowthPoint[]>('/api/reports/tenant-growth?months=12')).data,
  })
  const { data: coupons } = useQuery({
    queryKey: ['reports-coupons'],
    queryFn: async () => (await api.get<CouponPerformance>('/api/reports/coupons')).data,
  })
  const { data: transactions = [] } = useQuery({
    queryKey: ['reports-transactions', transactionsPage],
    queryFn: async () =>
      (await api.get<TransactionRow[]>(`/api/reports/transactions?limit=${pageSize}&offset=${transactionsPage * pageSize}`)).data,
  })

  const revenuePivoted = pivotByMethod(revenue)
  const creditsPivoted = pivotByMethod(credits)

  const thisMonthRevenue = revenue.reduce((sum, r) => sum + r.totalCents, 0) > 0
    ? revenuePivoted[revenuePivoted.length - 1]
    : null
  const thisMonthCredits = creditsPivoted[creditsPivoted.length - 1] ?? null
  const activeSubs = subs?.byStatus.find((s) => s.status === 'active')?.count ?? 0

  const statusData = subs ? capToOther(subs.byStatus.map((s) => ({ status: s.status, count: s.count })), (r) => r.status, 8) : []
  const planData = subs ? capToOther(subs.byPlan.map((p) => ({ planName: p.planName, count: p.count })), (r) => r.planName, 8) : []

  const chromeAxis = { stroke: palette.chrome.mutedInk, fontSize: 12 }
  const gridStroke = palette.chrome.gridline

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('page.subtitle')}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('kpi.subscriptionRevenue')}
          value={thisMonthRevenue ? formatCents(thisMonthRevenue.online + thisMonthRevenue.offline) : '—'}
          sub={t('kpi.thisMonth')}
          icon={DollarSign}
        />
        <StatCard
          label={t('kpi.creditRevenue')}
          value={thisMonthCredits ? formatCents(thisMonthCredits.online + thisMonthCredits.offline) : '—'}
          sub={t('kpi.thisMonth')}
          icon={Zap}
        />
        <StatCard label={t('kpi.activeSubscriptions')} value={String(activeSubs)} icon={Users2} />
        <StatCard
          label={t('kpi.totalDiscountGiven')}
          value={coupons ? formatCents(coupons.totalDiscountGivenCents) : '—'}
          sub={t('kpi.allTime')}
          icon={Ticket}
        />
      </div>

      {/* Revenue */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title={t('charts.subscriptionRevenue')}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenuePivoted}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} {...chromeAxis} />
              <YAxis tickFormatter={(v) => formatCents(v)} {...chromeAxis} width={70} />
              <Tooltip
                formatter={(value) => formatCents(Number(value))}
                labelFormatter={(label) => formatMonth(String(label))}
                contentStyle={{ background: palette.chrome.surface, borderColor: palette.chrome.gridline }}
              />
              <Legend />
              <Line type="monotone" dataKey="online" name={t('common.online')} stroke={palette.categorical[0]} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="offline" name={t('common.offline')} stroke={palette.categorical[1]} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('charts.creditRevenue')}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={creditsPivoted}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} {...chromeAxis} />
              <YAxis tickFormatter={(v) => formatCents(v)} {...chromeAxis} width={70} />
              <Tooltip
                formatter={(value) => formatCents(Number(value))}
                labelFormatter={(label) => formatMonth(String(label))}
                contentStyle={{ background: palette.chrome.surface, borderColor: palette.chrome.gridline }}
              />
              <Legend />
              <Line type="monotone" dataKey="online" name={t('common.online')} stroke={palette.categorical[0]} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="offline" name={t('common.offline')} stroke={palette.categorical[1]} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Subscriptions */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title={t('charts.subscriptionStatus')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="status" {...chromeAxis} />
              <YAxis allowDecimals={false} {...chromeAxis} width={40} />
              <Tooltip contentStyle={{ background: palette.chrome.surface, borderColor: palette.chrome.gridline }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24}>
                {statusData.map((_, i) => <Cell key={i} fill={palette.categorical[i % palette.categorical.length]} />)}
                <LabelList dataKey="count" position="top" fill={palette.chrome.secondaryInk} fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('charts.planPopularity')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planData}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="planName" {...chromeAxis} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} {...chromeAxis} width={40} />
              <Tooltip contentStyle={{ background: palette.chrome.surface, borderColor: palette.chrome.gridline }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24}>
                {planData.map((_, i) => <Cell key={i} fill={palette.categorical[i % palette.categorical.length]} />)}
                <LabelList dataKey="count" position="top" fill={palette.chrome.secondaryInk} fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tenant growth */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title={t('charts.newTenants')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tenantGrowth}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} {...chromeAxis} />
              <YAxis allowDecimals={false} {...chromeAxis} width={40} />
              <Tooltip
                labelFormatter={(label) => formatMonth(String(label))}
                contentStyle={{ background: palette.chrome.surface, borderColor: palette.chrome.gridline }}
              />
              <Bar dataKey="newTenants" name={t('charts.newTenants')} fill={palette.sequentialHue} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('charts.cumulativeTenants')}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tenantGrowth}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} {...chromeAxis} />
              <YAxis allowDecimals={false} {...chromeAxis} width={40} />
              <Tooltip
                labelFormatter={(label) => formatMonth(String(label))}
                contentStyle={{ background: palette.chrome.surface, borderColor: palette.chrome.gridline }}
              />
              <Line type="monotone" dataKey="cumulativeTotal" name={t('charts.cumulativeTenants')} stroke={palette.sequentialHue} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Coupons */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('couponsTable.title')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('couponsTable.code')}</TableHead>
              <TableHead>{t('couponsTable.discount')}</TableHead>
              <TableHead>{t('couponsTable.appliesTo')}</TableHead>
              <TableHead>{t('couponsTable.redemptions')}</TableHead>
              <TableHead>{t('couponsTable.discountGiven')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons?.coupons.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-medium">{c.code}</TableCell>
                <TableCell>{c.discountType === 'percentage' ? `${c.discountValue}%` : formatCents(c.discountValue)}</TableCell>
                <TableCell className="capitalize">{c.appliesTo}</TableCell>
                <TableCell>{c.redemptions}</TableCell>
                <TableCell>{formatCents(c.totalDiscountCents)}</TableCell>
                <TableCell>
                  <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? t('common:active') : t('common:inactive')}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {coupons && coupons.coupons.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t('couponsTable.empty')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Transactions */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('transactionsTable.title')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('transactionsTable.date')}</TableHead>
              <TableHead>{t('transactionsTable.tenant')}</TableHead>
              <TableHead>{t('transactionsTable.type')}</TableHead>
              <TableHead>{t('transactionsTable.method')}</TableHead>
              <TableHead>{t('transactionsTable.amount')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx, i) => (
              <TableRow key={i}>
                <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{tx.tenantName}</TableCell>
                <TableCell className="capitalize">{tx.type === 'subscription' ? t('transactionsTable.typeSubscription') : t('transactionsTable.typeRecharge')}</TableCell>
                <TableCell className="capitalize">{tx.method}</TableCell>
                <TableCell>{formatCents(tx.amountCents)}</TableCell>
                <TableCell className="capitalize">{tx.status}</TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t('transactionsTable.empty')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-6 py-3 border-t">
          <Button variant="outline" size="sm" disabled={transactionsPage === 0} onClick={() => setTransactionsPage((p) => p - 1)}>
            {t('common:previous')}
          </Button>
          <Button variant="outline" size="sm" disabled={transactions.length < pageSize} onClick={() => setTransactionsPage((p) => p + 1)}>
            {t('common:next')}
          </Button>
        </div>
      </div>
    </div>
  )
}

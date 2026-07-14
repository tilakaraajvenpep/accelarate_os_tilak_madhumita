import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, CreditCard, Building2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Plan, Tenant, CheckoutSessionResult } from '@/types/billing'

type AiProvider = 'openai' | 'anthropic'

interface AiProviderConfig {
  id: number
  provider: AiProvider
  model: string
  enabled: boolean
}

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude (Anthropic)',
}

const PROVIDER_SHORT_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function statusColor(status: string) {
  if (status === 'active') return 'text-green-600'
  if (status === 'trialing') return 'text-amber-600'
  if (status === 'past_due') return 'text-orange-600'
  return 'text-muted-foreground'
}

export default function PlansBillingPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [assignTenant, setAssignTenant] = useState<Tenant | null>(null)

  function formatLimit(limit: number | null) {
    return limit === null ? t('common.unlimited') : limit.toLocaleString()
  }

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get<Plan[]>('/api/plans')).data,
  })

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  function openCreatePlan() {
    setEditingPlan(null)
    setPlanDialogOpen(true)
  }

  function openEditPlan(plan: Plan) {
    setEditingPlan(plan)
    setPlanDialogOpen(true)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('superAdminPlans.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('superAdminPlans.subtitle')}
          </p>
        </div>
        <Button onClick={openCreatePlan}>
          <Plus className="h-4 w-4" /> {t('superAdminPlans.newPlan')}
        </Button>
      </div>

      {/* Plans table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('superAdminPlans.plansHeader')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('superAdminPlans.tableName')}</TableHead>
              <TableHead>{t('superAdminPlans.tableCohorts')}</TableHead>
              <TableHead>{t('superAdminPlans.tableFounders')}</TableHead>
              <TableHead>{t('superAdminPlans.tableStorage')}</TableHead>
              <TableHead>{t('superAdminPlans.tablePriceMo')}</TableHead>
              <TableHead>{t('superAdminPlans.tableAiModel')}</TableHead>
              <TableHead>{t('superAdminPlans.tableStatus')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">
                  {plan.name}
                  {plan.isCustom && (
                    <Badge variant="outline" className="ml-2">
                      {t('superAdminPlans.custom')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{formatLimit(plan.cohortsLimit)}</TableCell>
                <TableCell>{formatLimit(plan.foundersLimit)}</TableCell>
                <TableCell>
                  {plan.storageLimitGb === null ? t('common.unlimited') : `${plan.storageLimitGb} GB`}
                </TableCell>
                <TableCell>{formatCents(plan.priceMonthlyCents)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {plan.aiProvider ? PROVIDER_SHORT_LABELS[plan.aiProvider] : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={plan.active ? 'default' : 'secondary'}>
                    {plan.active ? t('superAdminPlans.active') : t('superAdminPlans.inactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditPlan(plan)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!plansLoading && plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  {t('superAdminPlans.noPlansYet')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tenant subscriptions table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('superAdminPlans.tenantSubsHeader')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('superAdminPlans.tableTenant')}</TableHead>
              <TableHead>{t('superAdminPlans.tablePlan')}</TableHead>
              <TableHead>{t('superAdminPlans.tableStatus')}</TableHead>
              <TableHead>{t('superAdminPlans.tableFoundersUsed')}</TableHead>
              <TableHead>{t('superAdminPlans.tableNextPayment')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell>{tenant.plan?.name ?? '—'}</TableCell>
                <TableCell>
                  <span className={cn('text-xs font-medium', statusColor(tenant.subscription?.status ?? ''))}>
                    {tenant.subscription ? tenant.subscription.status : t('superAdminPlans.noSubscription')}
                  </span>
                </TableCell>
                <TableCell>
                  {tenant.foundersUsed}
                  {tenant.plan?.foundersLimit != null ? ` / ${tenant.plan.foundersLimit}` : ''}
                </TableCell>
                <TableCell>
                  {tenant.subscription?.currentPeriodEnd
                    ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()
                    : '—'}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setAssignTenant(tenant)}>
                    {t('superAdminPlans.assignPlan')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!tenantsLoading && tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {t('superAdminPlans.noTenantsYet')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PlanFormDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        plan={editingPlan}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['plans'] })}
      />

      <AssignSubscriptionDialog
        tenant={assignTenant}
        plans={plans}
        onOpenChange={(open) => !open && setAssignTenant(null)}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ['tenants'] })
          queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
        }}
      />
    </div>
  )
}

interface PlanFormState {
  name: string
  description: string
  priceDollars: string
  isCustom: boolean
  enableOnlineBilling: boolean
  cohortsLimit: string
  cohortsUnlimited: boolean
  foundersLimit: string
  foundersUnlimited: boolean
  storageLimitGb: string
  storageUnlimited: boolean
  aiProviderConfigId: string
}

function planToFormState(plan: Plan | null): PlanFormState {
  return {
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    priceDollars: plan ? (plan.priceMonthlyCents / 100).toString() : '0',
    isCustom: plan?.isCustom ?? false,
    enableOnlineBilling: !!plan?.stripePriceId,
    cohortsLimit: plan?.cohortsLimit?.toString() ?? '',
    cohortsUnlimited: plan ? plan.cohortsLimit === null : false,
    foundersLimit: plan?.foundersLimit?.toString() ?? '',
    foundersUnlimited: plan ? plan.foundersLimit === null : false,
    storageLimitGb: plan?.storageLimitGb?.toString() ?? '',
    storageUnlimited: plan ? plan.storageLimitGb === null : false,
    aiProviderConfigId: plan?.aiProviderConfigId?.toString() ?? '',
  }
}

function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: Plan | null
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<PlanFormState>(() => planToFormState(plan))

  // Re-seed form whenever the dialog is (re)opened for a different plan.
  const [lastPlanId, setLastPlanId] = useState<number | null | undefined>(undefined)
  if (open && plan?.id !== lastPlanId) {
    setLastPlanId(plan?.id ?? null)
    setForm(planToFormState(plan))
  }

  const { data: aiConfigs = [] } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: async () => (await api.get<AiProviderConfig[]>('/api/ai-configs')).data,
    enabled: open,
  })
  const enabledAiConfigs = aiConfigs.filter((c) => c.enabled)

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        description: form.description || null,
        priceMonthlyCents: Math.round(parseFloat(form.priceDollars || '0') * 100),
        isCustom: form.isCustom,
        enableOnlineBilling: form.enableOnlineBilling,
        cohortsLimit: form.cohortsUnlimited ? null : form.cohortsLimit ? Number(form.cohortsLimit) : null,
        foundersLimit: form.foundersUnlimited ? null : form.foundersLimit ? Number(form.foundersLimit) : null,
        storageLimitGb: form.storageUnlimited ? null : form.storageLimitGb ? Number(form.storageLimitGb) : null,
        aiProviderConfigId: form.aiProviderConfigId ? Number(form.aiProviderConfigId) : null,
      }
      if (plan) {
        return (await api.patch(`/api/plans/${plan.id}`, body)).data
      }
      return (await api.post('/api/plans', body)).data
    },
    onSuccess: () => {
      toast.success(plan ? t('superAdminPlans.toast.planUpdated') : t('superAdminPlans.toast.planCreated'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(apiError(err, t('superAdminPlans.toast.saveFailed')))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? t('superAdminPlans.editPlan') : t('superAdminPlans.newPlanTitle')}</DialogTitle>
          <DialogDescription>{t('superAdminPlans.planDialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('common.name')}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('common.description')}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <LimitField
            label={t('superAdminPlans.cohortsLabel')}
            value={form.cohortsLimit}
            unlimited={form.cohortsUnlimited}
            onValueChange={(v) => setForm({ ...form, cohortsLimit: v })}
            onUnlimitedChange={(v) => setForm({ ...form, cohortsUnlimited: v })}
          />
          <LimitField
            label={t('superAdminPlans.foundersLearnersLabel')}
            value={form.foundersLimit}
            unlimited={form.foundersUnlimited}
            onValueChange={(v) => setForm({ ...form, foundersLimit: v })}
            onUnlimitedChange={(v) => setForm({ ...form, foundersUnlimited: v })}
          />
          <LimitField
            label={t('superAdminPlans.storageGbLabel')}
            value={form.storageLimitGb}
            unlimited={form.storageUnlimited}
            onValueChange={(v) => setForm({ ...form, storageLimitGb: v })}
            onUnlimitedChange={(v) => setForm({ ...form, storageUnlimited: v })}
          />

          <div className="space-y-1.5">
            <Label>{t('superAdminPlans.priceMonthLabel')}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.priceDollars}
              onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('superAdminPlans.aiModelLabel')}</Label>
            <Select
              value={form.aiProviderConfigId}
              onValueChange={(v) => setForm({ ...form, aiProviderConfigId: v === 'none' ? '' : v ?? '' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('superAdminPlans.selectAiModel')}>
                  {(value: string | null) => {
                    if (!value) return t('superAdminPlans.aiModelNone')
                    const selected = enabledAiConfigs.find((c) => String(c.id) === value)
                    return selected ? `${PROVIDER_LABELS[selected.provider]} — ${selected.model}` : t('superAdminPlans.selectAiModel')
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('superAdminPlans.aiModelNone')}</SelectItem>
                {enabledAiConfigs.map((config) => (
                  <SelectItem key={config.id} value={String(config.id)}>
                    {PROVIDER_LABELS[config.provider]} — {config.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {enabledAiConfigs.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('superAdminPlans.noAiConfigured')}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>{t('superAdminPlans.customPlan')}</Label>
              <p className="text-xs text-muted-foreground">{t('superAdminPlans.customPlanDesc')}</p>
            </div>
            <Switch
              checked={form.isCustom}
              onCheckedChange={(v: boolean) => setForm({ ...form, isCustom: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>{t('superAdminPlans.enableOnlineBilling')}</Label>
              <p className="text-xs text-muted-foreground">{t('superAdminPlans.enableOnlineBillingDesc')}</p>
            </div>
            <Switch
              checked={form.enableOnlineBilling}
              onCheckedChange={(v: boolean) => setForm({ ...form, enableOnlineBilling: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
            {plan ? t('common.saveChanges') : t('superAdminPlans.createPlan')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LimitField({
  label,
  value,
  unlimited,
  onValueChange,
  onUnlimitedChange,
}: {
  label: string
  value: string
  unlimited: boolean
  onValueChange: (v: string) => void
  onUnlimitedChange: (v: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('common.unlimited')}</span>
          <Switch checked={unlimited} onCheckedChange={onUnlimitedChange} />
        </div>
      </div>
      <Input
        type="number"
        min="0"
        disabled={unlimited}
        value={unlimited ? '' : value}
        placeholder={unlimited ? t('common.unlimited') : '0'}
        onChange={(e) => onValueChange(e.target.value)}
      />
    </div>
  )
}

function AssignSubscriptionDialog({
  tenant,
  plans,
  onOpenChange,
  onAssigned,
}: {
  tenant: Tenant | null
  plans: Plan[]
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  const { t } = useTranslation()
  const [planId, setPlanId] = useState<string>('')
  const [mode, setMode] = useState<'offline' | 'online'>('offline')
  const [amountDollars, setAmountDollars] = useState('')
  const [paidThroughDate, setPaidThroughDate] = useState('')
  const [note, setNote] = useState('')

  const selectedPlan = plans.find((p) => p.id === Number(planId))

  const offlineMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error('No tenant selected')
      return (
        await api.post(`/api/tenants/${tenant.id}/subscriptions/offline`, {
          planId: Number(planId),
          amountCents: Math.round(parseFloat(amountDollars || '0') * 100),
          paidThroughDate,
          note: note || null,
        })
      ).data
    },
    onSuccess: () => {
      toast.success(t('superAdminPlans.toast.offlineRecorded'))
      onAssigned()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('superAdminPlans.toast.recordFailed'))),
  })

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error('No tenant selected')
      return (
        await api.post<CheckoutSessionResult>(`/api/tenants/${tenant.id}/subscriptions/checkout`, {
          planId: Number(planId),
        })
      ).data
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        toast.success(t('superAdminPlans.toast.checkoutCreated'))
        onAssigned()
        onOpenChange(false)
      }
    },
    onError: (err) => toast.error(apiError(err, t('superAdminPlans.toast.checkoutFailed'))),
  })

  return (
    <Dialog open={!!tenant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('superAdminPlans.assignPlanTitle', { tenant: tenant?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('superAdminPlans.assignPlanDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('superAdminPlans.plan')}</Label>
            <Select value={planId} onValueChange={(v) => setPlanId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('superAdminPlans.selectPlan')}>
                  {(value: string | null) => {
                    const selected = plans.find((p) => String(p.id) === value)
                    return selected ? `${selected.name} — ${formatCents(selected.priceMonthlyCents)}/mo` : t('superAdminPlans.selectPlan')
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter((p) => p.active)
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — {formatCents(p.priceMonthlyCents)}/mo
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === 'offline' ? 'default' : 'outline'} onClick={() => setMode('offline')}>
              {t('superAdminPlans.recordOfflinePayment')}
            </Button>
            <Button
              variant={mode === 'online' ? 'default' : 'outline'}
              onClick={() => setMode('online')}
              disabled={!selectedPlan?.stripePriceId}
            >
              {t('superAdminPlans.payOnline')}
            </Button>
          </div>
          {mode === 'online' && !selectedPlan?.stripePriceId && (
            <p className="text-xs text-destructive">
              {t('superAdminPlans.notConfiguredOnlineBilling')}
            </p>
          )}

          {mode === 'offline' && (
            <>
              <div className="space-y-1.5">
                <Label>{t('superAdminPlans.amountReceived')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('superAdminPlans.activeUntil')}</Label>
                <Input
                  type="date"
                  value={paidThroughDate}
                  onChange={(e) => setPaidThroughDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('superAdminPlans.note')}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {mode === 'offline' ? (
            <Button
              onClick={() => offlineMutation.mutate()}
              disabled={!planId || !paidThroughDate || offlineMutation.isPending}
            >
              {t('superAdminPlans.recordPayment')}
            </Button>
          ) : (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={!planId || !selectedPlan?.stripePriceId || checkoutMutation.isPending}
            >
              {t('superAdminPlans.continueToStripe')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}

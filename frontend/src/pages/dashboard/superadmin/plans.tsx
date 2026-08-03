import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, CreditCard, Building2, Trash2, Check, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { openPicker } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useListControls } from '@/hooks/use-list-controls'
import { Loader } from '@/components/ui/loader'
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
import type { Plan, Tenant, CheckoutSessionResult, CouponValidationResult, SubscriptionConfirmation } from '@/types/billing'
import type { AiProviderConfig } from '@/types/ai-provider'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatLimit(limit: number | null, t: (key: string) => string) {
  return limit === null ? t('common:unlimited') : limit.toLocaleString()
}

function subscriptionStatusBadgeVariant(status: string): 'success' | 'warning' | 'secondary' {
  if (status === 'active') return 'success'
  if (status === 'trialing' || status === 'past_due') return 'warning'
  return 'secondary'
}

export default function PlansBillingPage() {
  const { t } = useTranslation('superadminPlans')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [assignTenant, setAssignTenant] = useState<Tenant | null>(null)
  const [checkoutConfirmation, setCheckoutConfirmation] = useState<SubscriptionConfirmation | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (!checkout) return

    const tenantId = params.get('tenantId')
    const subscriptionId = params.get('subscriptionId')
    window.history.replaceState(null, '', window.location.pathname)

    if (checkout === 'cancelled') {
      toast.error(t('toast.checkoutCancelled'))
      return
    }
    if (checkout === 'success' && tenantId && subscriptionId) {
      api
        .get<SubscriptionConfirmation>(`/api/tenants/${tenantId}/subscriptions/${subscriptionId}`)
        .then(({ data }) => setCheckoutConfirmation(data))
        .catch(() => toast.error(t('toast.checkoutConfirmationFailed')))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get<Plan[]>('/api/plans')).data,
  })

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  const planControls = useListControls(plans, {
    searchFields: (plan) => [plan.name],
    statusValue: (plan) => plan.active,
  })

  const [tenantPlanFilter, setTenantPlanFilter] = useState('all')
  const [tenantStatusFilter, setTenantStatusFilter] = useState('all')

  const tenantsByFilter = tenants.filter((tenant) => {
    if (tenantPlanFilter !== 'all' && String(tenant.plan?.id ?? '') !== tenantPlanFilter) return false
    if (tenantStatusFilter !== 'all') {
      const actualStatus = tenant.subscription?.status ?? 'no_subscription'
      if (actualStatus !== tenantStatusFilter) return false
    }
    return true
  })

  const tenantControls = useListControls(tenantsByFilter, {
    searchFields: (tenant) => [tenant.name, tenant.plan?.name],
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (params: { tenantId: number; subscriptionId: number }) =>
      (await api.delete(`/api/tenants/${params.tenantId}/subscriptions/${params.subscriptionId}`)).data,
    onSuccess: () => {
      toast.success(t('toast.subscriptionCanceled'))
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.cancelSubscriptionFailed'))),
  })

  async function handleCancelSubscription(tenant: Tenant) {
    if (!tenant.subscription) return
    const ok = await confirm({
      title: t('subscriptionsTable.cancelSubscriptionTitle'),
      description: t('subscriptionsTable.confirmCancelSubscription', { name: tenant.name }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (!ok) return
    cancelSubscriptionMutation.mutate({ tenantId: tenant.id, subscriptionId: tenant.subscription.id })
  }

  function openCreatePlan() {
    setEditingPlan(null)
    setPlanDialogOpen(true)
  }

  function openEditPlan(plan: Plan) {
    setEditingPlan(plan)
    setPlanDialogOpen(true)
  }

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: number) => (await api.delete(`/api/plans/${planId}`)).data,
    onSuccess: () => {
      toast.success(t('toast.planDeleted'))
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.deletePlanFailed'))),
  })

  async function handleDeletePlan(plan: Plan) {
    const ok = await confirm({
      title: t('deleteDialog.title'),
      description: t('deleteDialog.confirmDelete', { name: plan.name }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (!ok) return
    deletePlanMutation.mutate(plan.id)
  }

  const toggleActiveMutation = useMutation({
    mutationFn: async (params: { planId: number; active: boolean }) =>
      (await api.patch<Plan>(`/api/plans/${params.planId}`, { active: params.active })).data,
    onSuccess: (updated) => {
      toast.success(updated.active ? t('toast.planActivated') : t('toast.planDeactivated'))
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.updatePlanFailed'))),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('page.subtitle')}
          </p>
        </div>
        <Button onClick={openCreatePlan}>
          <Plus className="h-4 w-4" /> {t('page.newPlanButton')}
        </Button>
      </div>

      {/* Plans table */}
      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('plansTable.cardTitle')}</h2>
        </div>
        <div className="px-6 py-3 border-b">
          <ListToolbar controls={planControls} searchPlaceholder={t('common:search')} activeLabel={t('common:active')} inactiveLabel={t('common:inactive')} />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:name')}</TableHead>
                <TableHead>{t('plansTable.cohorts')}</TableHead>
                <TableHead>{t('plansTable.founders')}</TableHead>
                <TableHead>{t('plansTable.storage')}</TableHead>
                <TableHead>{t('plansTable.priceMonth')}</TableHead>
                <TableHead>{t('plansTable.aiCredits')}</TableHead>
                <TableHead className="text-center">{t('common:status')}</TableHead>
                <TableHead className="text-center">{t('common:actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plansLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10">
                    <Loader />
                  </TableCell>
                </TableRow>
              ) : (
                planControls.paged.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      {plan.name}
                      {plan.isCustom && (
                        <Badge variant="outline" className="ml-2">
                          {t('plansTable.custom')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatLimit(plan.cohortsLimit, t)}</TableCell>
                    <TableCell>{formatLimit(plan.foundersLimit, t)}</TableCell>
                    <TableCell>
                      {plan.storageLimitGb === null ? t('common:unlimited') : `${plan.storageLimitGb} GB`}
                    </TableCell>
                    <TableCell>{formatCents(plan.priceMonthlyCents)}</TableCell>
                    <TableCell>{plan.aiCredits.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-3">
                        <Badge variant={plan.active ? 'success' : 'secondary'}>
                          {plan.active ? t('common:active') : t('common:inactive')}
                        </Badge>
                        <Switch
                          checked={plan.active}
                          disabled={toggleActiveMutation.isPending}
                          onCheckedChange={(checked: boolean) => toggleActiveMutation.mutate({ planId: plan.id, active: checked })}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon-sm" title={t('common:edit')} onClick={() => openEditPlan(plan)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title={t('common:delete')} onClick={() => handleDeletePlan(plan)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!plansLoading && planControls.paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('plansTable.empty')}</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 py-3 border-t">
          <ListPagination controls={planControls} />
        </div>
      </div>

      {/* Tenant subscriptions table */}
      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('subscriptionsTable.cardTitle')}</h2>
        </div>
        <div className="px-6 py-3 border-b">
          <ListToolbar
            controls={tenantControls}
            searchPlaceholder={t('common:search')}
            extraFilters={
              <>
                <Select value={tenantPlanFilter} onValueChange={(v) => v && setTenantPlanFilter(v)}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue>{(v: string) => (v === 'all' ? t('subscriptionsTable.allPlans') : plans.find((p) => String(p.id) === v)?.name ?? v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('subscriptionsTable.allPlans')}</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={tenantStatusFilter} onValueChange={(v) => v && setTenantStatusFilter(v)}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('subscriptionsTable.allStatuses')}</SelectItem>
                    <SelectItem value="active">{t('common:active')}</SelectItem>
                    <SelectItem value="trialing">{t('subscriptionsTable.trialing')}</SelectItem>
                    <SelectItem value="past_due">{t('subscriptionsTable.pastDue')}</SelectItem>
                    <SelectItem value="canceled">{t('subscriptionsTable.canceled')}</SelectItem>
                    <SelectItem value="expired">{t('subscriptionsTable.expired')}</SelectItem>
                    <SelectItem value="no_subscription">{t('subscriptionsTable.noSubscription')}</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subscriptionsTable.tenant')}</TableHead>
                <TableHead>{t('subscriptionsTable.plan')}</TableHead>
                <TableHead className="text-center">{t('common:status')}</TableHead>
                <TableHead>{t('subscriptionsTable.foundersUsed')}</TableHead>
                <TableHead>{t('subscriptionsTable.nextPayment')}</TableHead>
                <TableHead className="text-center">{t('common:actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10">
                    <Loader />
                  </TableCell>
                </TableRow>
              ) : (
                tenantControls.paged.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.plan?.name ?? '—'}</TableCell>
                    <TableCell className="text-center">
                      {tenant.subscription ? (
                        <Badge variant={subscriptionStatusBadgeVariant(tenant.subscription.status)} className="capitalize">
                          {tenant.subscription.status}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t('subscriptionsTable.noSubscription')}</Badge>
                      )}
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
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAssignTenant(tenant)}>
                          {t('subscriptionsTable.assignPlanButton')}
                        </Button>
                        {tenant.subscription && tenant.subscription.status !== 'canceled' ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={t('subscriptionsTable.cancelSubscriptionTitle')}
                            disabled={cancelSubscriptionMutation.isPending}
                            onClick={() => handleCancelSubscription(tenant)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        ) : (
                          <div className="size-7 shrink-0" aria-hidden="true" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!tenantsLoading && tenantControls.paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('subscriptionsTable.empty')}</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 py-3 border-t">
          <ListPagination controls={tenantControls} />
        </div>
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

      <Dialog open={!!checkoutConfirmation} onOpenChange={(open) => !open && setCheckoutConfirmation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('checkoutConfirmation.title')}</DialogTitle>
            <DialogDescription>{t('checkoutConfirmation.description')}</DialogDescription>
          </DialogHeader>
          {checkoutConfirmation && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">{t('checkoutConfirmation.plan')}</span>
                <span className="text-sm font-semibold">{checkoutConfirmation.planName}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">{t('checkoutConfirmation.amount')}</span>
                <span className="text-sm font-semibold">
                  {formatCents(checkoutConfirmation.priceMonthlyCents - (checkoutConfirmation.discountAmountCents ?? 0))}/mo
                </span>
              </div>
              {checkoutConfirmation.couponCode && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">{t('checkoutConfirmation.coupon')}</span>
                  <span className="text-sm font-mono font-semibold">{checkoutConfirmation.couponCode}</span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">{t('common:status')}</span>
                <Badge variant={checkoutConfirmation.status === 'active' ? 'success' : 'secondary'}>
                  {checkoutConfirmation.status}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCheckoutConfirmation(null)}>{t('common:close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  aiCredits: string
  aiProviderConfigIds: number[]
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
    aiCredits: plan ? plan.aiCredits.toString() : '0',
    aiProviderConfigIds: plan?.aiProviderConfigIds ?? [],
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
  const { t } = useTranslation('superadminPlans')
  const [form, setForm] = useState<PlanFormState>(() => planToFormState(plan))

  const { data: aiConfigs = [] } = useQuery<AiProviderConfig[]>({
    queryKey: ['ai-provider-configs'],
    queryFn: async () => (await api.get('/api/ai-provider-configs')).data,
  })

  // Re-seed form whenever the dialog is (re)opened for a different plan.
  const [lastPlanId, setLastPlanId] = useState<number | null | undefined>(undefined)
  if (open && plan?.id !== lastPlanId) {
    setLastPlanId(plan?.id ?? null)
    setForm(planToFormState(plan))
  }

  function handleOpenChange(next: boolean) {
    // Revert any unsaved edits the instant the dialog closes, rather than waiting for it to reopen.
    if (!next) setForm(planToFormState(plan))
    onOpenChange(next)
  }

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
        aiCredits: form.aiCredits ? Number(form.aiCredits) : 0,
        aiProviderConfigIds: form.aiProviderConfigIds,
      }
      if (plan) {
        return (await api.patch(`/api/plans/${plan.id}`, body)).data
      }
      return (await api.post('/api/plans', body)).data
    },
    onSuccess: () => {
      toast.success(plan ? t('toast.planUpdated') : t('toast.planCreated'))
      onSaved()
      handleOpenChange(false)
    },
    onError: (err) => {
      toast.error(apiError(err, t('toast.savePlanFailed')))
    },
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? t('planDialog.editTitle') : t('planDialog.newTitle')}</DialogTitle>
          <DialogDescription>{t('planDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('common:name')}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('planDialog.descriptionLabel')}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <LimitField
            label={t('planDialog.cohorts')}
            value={form.cohortsLimit}
            unlimited={form.cohortsUnlimited}
            onValueChange={(v) => setForm({ ...form, cohortsLimit: v })}
            onUnlimitedChange={(v) => setForm({ ...form, cohortsUnlimited: v })}
          />
          <LimitField
            label={t('planDialog.foundersLearners')}
            value={form.foundersLimit}
            unlimited={form.foundersUnlimited}
            onValueChange={(v) => setForm({ ...form, foundersLimit: v })}
            onUnlimitedChange={(v) => setForm({ ...form, foundersUnlimited: v })}
          />
          <LimitField
            label={t('planDialog.storageGb')}
            value={form.storageLimitGb}
            unlimited={form.storageUnlimited}
            onValueChange={(v) => setForm({ ...form, storageLimitGb: v })}
            onUnlimitedChange={(v) => setForm({ ...form, storageUnlimited: v })}
          />

          <div className="space-y-1.5">
            <Label>{t('planDialog.aiCredits')}</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={form.aiCredits}
              onChange={(e) => setForm({ ...form, aiCredits: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{t('planDialog.aiCreditsHint')}</p>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>Assigned AI Provider Keys</Label>
            <p className="text-xs text-muted-foreground">Select AI provider key(s) assigned to this plan.</p>
            {aiConfigs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No AI keys configured in Settings.</p>
            ) : (
              <div className="space-y-2 pt-1">
                {aiConfigs.map((cfg) => {
                  const checked = form.aiProviderConfigIds.includes(cfg.id)
                  return (
                    <label key={cfg.id} className="flex items-center justify-between text-sm cursor-pointer border rounded-md p-2 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...form.aiProviderConfigIds, cfg.id]
                              : form.aiProviderConfigIds.filter((id) => id !== cfg.id)
                            setForm({ ...form, aiProviderConfigIds: next })
                          }}
                          className="rounded border-input text-primary focus:ring-ring"
                        />
                        <span className="capitalize font-medium">{cfg.provider}</span>
                        <span className="text-xs text-muted-foreground font-mono">(...{cfg.apiKeyLastFour})</span>
                      </div>
                      <Badge variant={cfg.enabled ? 'outline' : 'secondary'} className="text-[10px]">
                        {cfg.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('planDialog.priceMonthUsd')}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.priceDollars}
              onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>{t('planDialog.customPlan')}</Label>
              <p className="text-xs text-muted-foreground">{t('planDialog.customPlanHint')}</p>
            </div>
            <Switch
              checked={form.isCustom}
              onCheckedChange={(v: boolean) => setForm({ ...form, isCustom: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>{t('planDialog.enableOnlineBilling')}</Label>
              <p className="text-xs text-muted-foreground">{t('planDialog.enableOnlineBillingHint')}</p>
            </div>
            <Switch
              checked={form.enableOnlineBilling}
              onCheckedChange={(v: boolean) => setForm({ ...form, enableOnlineBilling: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
            {plan ? t('common:saveChanges') : t('planDialog.createButton')}
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
  const { t } = useTranslation('superadminPlans')
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('common:unlimited')}</span>
          <Switch checked={unlimited} onCheckedChange={onUnlimitedChange} />
        </div>
      </div>
      <Input
        type="number"
        min="0"
        disabled={unlimited}
        value={unlimited ? '' : value}
        placeholder={unlimited ? t('common:unlimited') : '0'}
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
  const { t } = useTranslation('superadminPlans')
  const [planId, setPlanId] = useState<string>('')
  const [mode, setMode] = useState<'offline' | 'online'>('offline')
  const [amountDollars, setAmountDollars] = useState('')
  const [paidThroughDate, setPaidThroughDate] = useState('')
  const [note, setNote] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  function resetForm() {
    setPlanId('')
    setMode('offline')
    setAmountDollars('')
    setPaidThroughDate('')
    setNote('')
    setCouponCode('')
    setCouponResult(null)
    setCouponError(null)
  }

  // Re-seed whenever a different tenant is targeted, and revert any unsaved edits the instant the dialog closes.
  const [lastTenantId, setLastTenantId] = useState<number | null>(null)
  if (tenant && tenant.id !== lastTenantId) {
    setLastTenantId(tenant.id)
    resetForm()
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const selectedPlan = plans.find((p) => p.id === Number(planId))

  const couponMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) throw new Error('Select a plan first')
      return (
        await api.post<CouponValidationResult>('/api/coupons/validate', {
          code: couponCode,
          appliesTo: 'purchase',
          grossAmountCents: selectedPlan.priceMonthlyCents,
        })
      ).data
    },
    onSuccess: (data) => {
      setCouponResult(data)
      setCouponError(null)
      if (mode === 'offline' && selectedPlan) {
        setAmountDollars(((selectedPlan.priceMonthlyCents - data.discountCents) / 100).toFixed(2))
      }
    },
    onError: (err) => {
      setCouponResult(null)
      setCouponError(apiError(err, t('assignDialog.couponInvalid')))
    },
  })

  const offlineMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error('No tenant selected')
      return (
        await api.post(`/api/tenants/${tenant.id}/subscriptions/offline`, {
          planId: Number(planId),
          amountCents: Math.round(parseFloat(amountDollars || '0') * 100),
          paidThroughDate,
          note: note || null,
          couponCode: couponResult ? couponCode : undefined,
        })
      ).data
    },
    onSuccess: () => {
      toast.success(t('toast.offlinePaymentRecorded'))
      onAssigned()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.recordPaymentFailed'))),
  })

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error('No tenant selected')
      return (
        await api.post<CheckoutSessionResult>(`/api/tenants/${tenant.id}/subscriptions/checkout`, {
          planId: Number(planId),
          couponCode: couponResult ? couponCode : undefined,
        })
      ).data
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        toast.success(t('toast.checkoutSessionCreated'))
        onAssigned()
        handleOpenChange(false)
      }
    },
    onError: (err) => toast.error(apiError(err, t('toast.startCheckoutFailed'))),
  })

  return (
    <Dialog open={!!tenant} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('assignDialog.title', { name: tenant?.name })}</DialogTitle>
          <DialogDescription>{t('assignDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('assignDialog.planLabel')}</Label>
            <Select value={planId} onValueChange={(v) => setPlanId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('assignDialog.planPlaceholder')}>
                  {(value: string | null) => {
                    const selected = plans.find((p) => String(p.id) === value)
                    return selected ? `${selected.name} — ${formatCents(selected.priceMonthlyCents)}/mo` : t('assignDialog.planPlaceholder')
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

          <div className="space-y-1.5">
            <Label>{t('assignDialog.couponLabel')}</Label>
            <div className="flex gap-2">
              <Input
                value={couponCode}
                placeholder={t('assignDialog.couponPlaceholder')}
                className="font-mono"
                disabled={!!couponResult}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase())
                  setCouponResult(null)
                  setCouponError(null)
                }}
              />
              <Button
                type="button"
                variant={couponResult ? 'secondary' : 'outline'}
                disabled={!couponResult && (!couponCode || !selectedPlan || couponMutation.isPending)}
                onClick={() => {
                  if (couponResult) {
                    setCouponResult(null)
                    setCouponCode('')
                    toast.info(t('assignDialog.couponRemoved'))
                  } else {
                    couponMutation.mutate()
                  }
                }}
              >
                {couponResult ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> {t('assignDialog.couponAppliedButton')}
                  </>
                ) : (
                  t('assignDialog.couponApply')
                )}
              </Button>
            </div>
            {couponResult && (
              <p className="text-xs text-foreground font-medium">
                {t('assignDialog.couponApplied', { amount: formatCents(couponResult.discountCents) })}
              </p>
            )}
            {couponError && <p className="text-xs text-destructive">{couponError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === 'offline' ? 'default' : 'outline'} onClick={() => setMode('offline')}>
              {t('assignDialog.recordOfflinePayment')}
            </Button>
            <Button
              variant={mode === 'online' ? 'default' : 'outline'}
              onClick={() => setMode('online')}
              disabled={!selectedPlan?.stripePriceId}
            >
              {t('assignDialog.payOnline')}
            </Button>
          </div>
          {mode === 'online' && !selectedPlan?.stripePriceId && (
            <p className="text-xs text-destructive">
              {t('assignDialog.onlineBillingNotConfigured')}
            </p>
          )}

          {mode === 'offline' && (
            <>
              <div className="space-y-1.5">
                <Label required>{t('assignDialog.amountReceivedUsd')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label required>{t('assignDialog.activeUntil')}</Label>
                <Input
                  type="date"
                  value={paidThroughDate}
                  onChange={(e) => setPaidThroughDate(e.target.value)}
                  onClick={openPicker}
                  onFocus={openPicker}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('assignDialog.note')}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          {mode === 'offline' ? (
            <Button
              onClick={() => offlineMutation.mutate()}
              disabled={!planId || !paidThroughDate || offlineMutation.isPending}
            >
              {t('assignDialog.recordPaymentButton')}
            </Button>
          ) : (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={!planId || !selectedPlan?.stripePriceId || checkoutMutation.isPending}
            >
              {t('assignDialog.continueToStripeButton')}
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

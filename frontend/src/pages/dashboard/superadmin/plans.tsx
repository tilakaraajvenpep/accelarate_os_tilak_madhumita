import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, CreditCard, Building2, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
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

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatLimit(limit: number | null, t: (key: string) => string) {
  return limit === null ? t('common:unlimited') : limit.toLocaleString()
}

function statusColor(status: string) {
  if (status === 'active') return 'text-green-600'
  if (status === 'trialing') return 'text-amber-600'
  if (status === 'past_due') return 'text-orange-600'
  return 'text-muted-foreground'
}

export default function PlansBillingPage() {
  const { t } = useTranslation('superadminPlans')
  const queryClient = useQueryClient()
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [assignTenant, setAssignTenant] = useState<Tenant | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null)

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get<Plan[]>('/api/plans')).data,
  })

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
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

  function handleCancelSubscription(tenant: Tenant) {
    if (!tenant.subscription) return
    if (!window.confirm(t('subscriptionsTable.confirmCancelSubscription', { name: tenant.name }))) {
      return
    }
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
      setDeletingPlan(null)
    },
    onError: (err) => toast.error(apiError(err, t('toast.deletePlanFailed'))),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('page.subtitle')}
          </p>
        </div>
        <Button onClick={openCreatePlan}>
          <Plus className="h-4 w-4" /> {t('page.newPlanButton')}
        </Button>
      </div>

      {/* Plans table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('plansTable.cardTitle')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common:name')}</TableHead>
              <TableHead>{t('plansTable.cohorts')}</TableHead>
              <TableHead>{t('plansTable.founders')}</TableHead>
              <TableHead>{t('plansTable.storage')}</TableHead>
              <TableHead>{t('plansTable.priceMonth')}</TableHead>
              <TableHead>{t('plansTable.aiCredits')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
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
                  <Badge variant={plan.active ? 'default' : 'secondary'}>
                    {plan.active ? t('common:active') : t('common:inactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" title={t('common:edit')} onClick={() => openEditPlan(plan)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title={t('common:delete')} onClick={() => setDeletingPlan(plan)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!plansLoading && plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  {t('plansTable.empty')}
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
          <h2 className="font-semibold">{t('subscriptionsTable.cardTitle')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('subscriptionsTable.tenant')}</TableHead>
              <TableHead>{t('subscriptionsTable.plan')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
              <TableHead>{t('subscriptionsTable.foundersUsed')}</TableHead>
              <TableHead>{t('subscriptionsTable.nextPayment')}</TableHead>
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
                    {tenant.subscription ? tenant.subscription.status : t('subscriptionsTable.noSubscription')}
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
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAssignTenant(tenant)}>
                      {t('subscriptionsTable.assignPlanButton')}
                    </Button>
                    {tenant.subscription && tenant.subscription.status !== 'canceled' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('subscriptionsTable.cancelSubscriptionTitle')}
                        disabled={cancelSubscriptionMutation.isPending}
                        onClick={() => handleCancelSubscription(tenant)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!tenantsLoading && tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {t('subscriptionsTable.empty')}
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

      <DeletePlanDialog
        plan={deletingPlan}
        onOpenChange={(open) => !open && setDeletingPlan(null)}
        onConfirm={() => deletingPlan && deletePlanMutation.mutate(deletingPlan.id)}
        pending={deletePlanMutation.isPending}
      />
    </div>
  )
}

function DeletePlanDialog({
  plan,
  onOpenChange,
  onConfirm,
  pending,
}: {
  plan: Plan | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  const { t } = useTranslation('superadminPlans')
  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('deleteDialog.confirmDelete', { name: plan?.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {t('common:delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  // Re-seed form whenever the dialog is (re)opened for a different plan.
  const [lastPlanId, setLastPlanId] = useState<number | null | undefined>(undefined)
  if (open && plan?.id !== lastPlanId) {
    setLastPlanId(plan?.id ?? null)
    setForm(planToFormState(plan))
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
      }
      if (plan) {
        return (await api.patch(`/api/plans/${plan.id}`, body)).data
      }
      return (await api.post('/api/plans', body)).data
    },
    onSuccess: () => {
      toast.success(plan ? t('toast.planUpdated') : t('toast.planCreated'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(apiError(err, t('toast.savePlanFailed')))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? t('planDialog.editTitle') : t('planDialog.newTitle')}</DialogTitle>
          <DialogDescription>{t('planDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('common:name')}</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
      toast.success(t('toast.offlinePaymentRecorded'))
      onAssigned()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.recordPaymentFailed'))),
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
        toast.success(t('toast.checkoutSessionCreated'))
        onAssigned()
        onOpenChange(false)
      }
    },
    onError: (err) => toast.error(apiError(err, t('toast.startCheckoutFailed'))),
  })

  return (
    <Dialog open={!!tenant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('assignDialog.title', { name: tenant?.name })}</DialogTitle>
          <DialogDescription>{t('assignDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('assignDialog.planLabel')}</Label>
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
                <Label>{t('assignDialog.amountReceivedUsd')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('assignDialog.activeUntil')}</Label>
                <Input
                  type="date"
                  value={paidThroughDate}
                  onChange={(e) => setPaidThroughDate(e.target.value)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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

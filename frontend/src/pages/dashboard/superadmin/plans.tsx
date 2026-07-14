import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { PROVIDER_LABELS } from '@/lib/ai-provider'
import type { Plan, Tenant, CheckoutSessionResult } from '@/types/billing'
import type { AiProviderConfig } from '@/types/ai-provider'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatLimit(limit: number | null) {
  return limit === null ? 'Unlimited' : limit.toLocaleString()
}

function statusColor(status: string) {
  if (status === 'active') return 'text-green-600'
  if (status === 'trialing') return 'text-amber-600'
  if (status === 'past_due') return 'text-orange-600'
  return 'text-muted-foreground'
}

export default function PlansBillingPage() {
  const queryClient = useQueryClient()
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [assignTenant, setAssignTenant] = useState<Tenant | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null)

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get<Plan[]>('/api/plans')).data,
  })

  const { data: aiConfigs = [] } = useQuery({
    queryKey: ['ai-provider-configs'],
    queryFn: async () => (await api.get<AiProviderConfig[]>('/api/ai-provider-configs')).data,
  })
  const aiConfigLabel = (id: number | null) => {
    if (id === null) return '—'
    const config = aiConfigs.find((c) => c.id === id)
    return config ? `${PROVIDER_LABELS[config.provider]} — ${config.model}` : '—'
  }

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (params: { tenantId: number; subscriptionId: number }) =>
      (await api.delete(`/api/tenants/${params.tenantId}/subscriptions/${params.subscriptionId}`)).data,
    onSuccess: () => {
      toast.success('Subscription canceled')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
    },
    onError: (err) => toast.error(apiError(err, 'Failed to cancel subscription')),
  })

  function handleCancelSubscription(tenant: Tenant) {
    if (!tenant.subscription) return
    if (!window.confirm(`Cancel ${tenant.name}'s subscription? This can't be undone from here — you'd need to assign a new plan.`)) {
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
      toast.success('Plan deleted')
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setDeletingPlan(null)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to delete plan')),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plans & Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define plans and manage tenant subscriptions.
          </p>
        </div>
        <Button onClick={openCreatePlan}>
          <Plus className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {/* Plans table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Plans</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Cohorts</TableHead>
              <TableHead>Founders</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Price / month</TableHead>
              <TableHead>AI Key</TableHead>
              <TableHead>Status</TableHead>
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
                      Custom
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{formatLimit(plan.cohortsLimit)}</TableCell>
                <TableCell>{formatLimit(plan.foundersLimit)}</TableCell>
                <TableCell>
                  {plan.storageLimitGb === null ? 'Unlimited' : `${plan.storageLimitGb} GB`}
                </TableCell>
                <TableCell>{formatCents(plan.priceMonthlyCents)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{aiConfigLabel(plan.aiProviderConfigId)}</TableCell>
                <TableCell>
                  <Badge variant={plan.active ? 'default' : 'secondary'}>
                    {plan.active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => openEditPlan(plan)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => setDeletingPlan(plan)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!plansLoading && plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No plans yet — create one to get started.
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
          <h2 className="font-semibold">Tenant Subscriptions</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Founders used</TableHead>
              <TableHead>Next payment</TableHead>
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
                    {tenant.subscription ? tenant.subscription.status : 'No subscription'}
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
                      Assign Plan
                    </Button>
                    {tenant.subscription && tenant.subscription.status !== 'canceled' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Cancel subscription"
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
                  No tenants yet.
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
  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete plan</DialogTitle>
          <DialogDescription>
            Permanently delete "{plan?.name}"? Tenants currently subscribed to it will need to be reassigned first. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            Delete
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
    aiProviderConfigId: plan?.aiProviderConfigId != null ? String(plan.aiProviderConfigId) : 'none',
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
  const [form, setForm] = useState<PlanFormState>(() => planToFormState(plan))

  // Re-seed form whenever the dialog is (re)opened for a different plan.
  const [lastPlanId, setLastPlanId] = useState<number | null | undefined>(undefined)
  if (open && plan?.id !== lastPlanId) {
    setLastPlanId(plan?.id ?? null)
    setForm(planToFormState(plan))
  }

  const { data: aiConfigs = [] } = useQuery({
    queryKey: ['ai-provider-configs'],
    queryFn: async () => (await api.get<AiProviderConfig[]>('/api/ai-provider-configs')).data,
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
        aiProviderConfigId: form.aiProviderConfigId === 'none' ? null : Number(form.aiProviderConfigId),
      }
      if (plan) {
        return (await api.patch(`/api/plans/${plan.id}`, body)).data
      }
      return (await api.post('/api/plans', body)).data
    },
    onSuccess: () => {
      toast.success(plan ? 'Plan updated' : 'Plan created')
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(apiError(err, 'Failed to save plan'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle>
          <DialogDescription>Define limits and pricing for this plan.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <LimitField
            label="Cohorts"
            value={form.cohortsLimit}
            unlimited={form.cohortsUnlimited}
            onValueChange={(v) => setForm({ ...form, cohortsLimit: v })}
            onUnlimitedChange={(v) => setForm({ ...form, cohortsUnlimited: v })}
          />
          <LimitField
            label="Founders / learners"
            value={form.foundersLimit}
            unlimited={form.foundersUnlimited}
            onValueChange={(v) => setForm({ ...form, foundersLimit: v })}
            onUnlimitedChange={(v) => setForm({ ...form, foundersUnlimited: v })}
          />
          <LimitField
            label="Storage (GB)"
            value={form.storageLimitGb}
            unlimited={form.storageUnlimited}
            onValueChange={(v) => setForm({ ...form, storageLimitGb: v })}
            onUnlimitedChange={(v) => setForm({ ...form, storageUnlimited: v })}
          />

          <div className="space-y-1.5">
            <Label>AI key</Label>
            <Select
              value={form.aiProviderConfigId}
              onValueChange={(v) => setForm({ ...form, aiProviderConfigId: v ?? 'none' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {enabledAiConfigs.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {PROVIDER_LABELS[c.provider]} — {c.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Which AI provider key this plan's AI features will use.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Price / month (USD)</Label>
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
              <Label>Custom plan</Label>
              <p className="text-xs text-muted-foreground">Bespoke plan negotiated with a tenant</p>
            </div>
            <Switch
              checked={form.isCustom}
              onCheckedChange={(v: boolean) => setForm({ ...form, isCustom: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Enable online billing</Label>
              <p className="text-xs text-muted-foreground">Syncs a Stripe product/price for Checkout</p>
            </div>
            <Switch
              checked={form.enableOnlineBilling}
              onCheckedChange={(v: boolean) => setForm({ ...form, enableOnlineBilling: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
            {plan ? 'Save changes' : 'Create plan'}
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
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Unlimited</span>
          <Switch checked={unlimited} onCheckedChange={onUnlimitedChange} />
        </div>
      </div>
      <Input
        type="number"
        min="0"
        disabled={unlimited}
        value={unlimited ? '' : value}
        placeholder={unlimited ? 'Unlimited' : '0'}
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
      toast.success('Offline payment recorded')
      onAssigned()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to record payment')),
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
        toast.success('Checkout session created')
        onAssigned()
        onOpenChange(false)
      }
    },
    onError: (err) => toast.error(apiError(err, 'Failed to start checkout')),
  })

  return (
    <Dialog open={!!tenant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign plan — {tenant?.name}</DialogTitle>
          <DialogDescription>Pick a plan and how this tenant will pay.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={(v) => setPlanId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a plan">
                  {(value: string | null) => {
                    const selected = plans.find((p) => String(p.id) === value)
                    return selected ? `${selected.name} — ${formatCents(selected.priceMonthlyCents)}/mo` : 'Select a plan'
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
              Record offline payment
            </Button>
            <Button
              variant={mode === 'online' ? 'default' : 'outline'}
              onClick={() => setMode('online')}
              disabled={!selectedPlan?.stripePriceId}
            >
              Pay online
            </Button>
          </div>
          {mode === 'online' && !selectedPlan?.stripePriceId && (
            <p className="text-xs text-destructive">
              This plan isn't configured for online billing yet — enable it when editing the plan.
            </p>
          )}

          {mode === 'offline' && (
            <>
              <div className="space-y-1.5">
                <Label>Amount received (USD)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Active until</Label>
                <Input
                  type="date"
                  value={paidThroughDate}
                  onChange={(e) => setPaidThroughDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note (PO / check number, etc.)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === 'offline' ? (
            <Button
              onClick={() => offlineMutation.mutate()}
              disabled={!planId || !paidThroughDate || offlineMutation.isPending}
            >
              Record payment
            </Button>
          ) : (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={!planId || !selectedPlan?.stripePriceId || checkoutMutation.isPending}
            >
              Continue to Stripe
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

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react'
import { api } from '@/lib/api'
import { openPicker } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import type { Coupon, CouponDiscountType, CouponAppliesTo } from '@/types/billing'

function formatDiscount(coupon: Coupon) {
  if (coupon.discountType === 'percentage') {
    const cap = coupon.maxDiscountCents != null ? ` (max $${(coupon.maxDiscountCents / 100).toFixed(2)})` : ''
    return `${coupon.discountValue}%${cap}`
  }
  return `$${(coupon.discountValue / 100).toFixed(2)}`
}

function couponStatus(coupon: Coupon): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!coupon.active) return { label: 'Inactive', variant: 'secondary' }
  const now = new Date()
  if (coupon.startAt && now < new Date(coupon.startAt)) return { label: 'Scheduled', variant: 'outline' }
  if (coupon.endAt && now > new Date(coupon.endAt)) return { label: 'Expired', variant: 'destructive' }
  return { label: 'Active', variant: 'default' }
}

export default function CouponsPage() {
  const { t } = useTranslation('superadminCoupons')
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null)

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => (await api.get<Coupon[]>('/api/coupons')).data,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/coupons/${id}`)).data,
    onSuccess: () => {
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      setDeletingCoupon(null)
    },
    onError: (err) => toast.error(apiError(err, t('toast.deleteFailed'))),
  })

  function openCreate() {
    setEditingCoupon(null)
    setDialogOpen(true)
  }

  function openEdit(coupon: Coupon) {
    setEditingCoupon(coupon)
    setDialogOpen(true)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('page.newCouponButton')}
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('table.cardTitle')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.code')}</TableHead>
              <TableHead>{t('table.discount')}</TableHead>
              <TableHead>{t('table.appliesTo')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => {
              const status = couponStatus(coupon)
              return (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-medium">{coupon.code}</TableCell>
                  <TableCell>{formatDiscount(coupon)}</TableCell>
                  <TableCell className="capitalize">{coupon.appliesTo}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title={t('common:edit')} onClick={() => openEdit(coupon)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title={t('common:delete')} onClick={() => setDeletingCoupon(coupon)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {!isLoading && coupons.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  {t('table.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CouponFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coupon={editingCoupon}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['coupons'] })}
      />

      <Dialog open={!!deletingCoupon} onOpenChange={(open) => !open && setDeletingCoupon(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>{t('deleteDialog.confirmDelete', { code: deletingCoupon?.code })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCoupon(null)}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingCoupon && deleteMutation.mutate(deletingCoupon.id)}
            >
              {t('common:delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CouponFormState {
  code: string
  discountType: CouponDiscountType
  discountValue: string
  maxDiscountDollars: string
  appliesTo: CouponAppliesTo
  hasMinPurchase: boolean
  minPurchaseDollars: string
  hasPerCustomerLimit: boolean
  perCustomerLimit: string
  hasTotalUsageLimit: boolean
  totalUsageLimit: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  active: boolean
}

function couponToFormState(coupon: Coupon | null): CouponFormState {
  const [startDate, startTime] = coupon?.startAt ? toLocalDateAndTime(coupon.startAt) : ['', '']
  const [endDate, endTime] = coupon?.endAt ? toLocalDateAndTime(coupon.endAt) : ['', '']
  return {
    code: coupon?.code ?? '',
    discountType: coupon?.discountType ?? 'percentage',
    discountValue: coupon ? (coupon.discountType === 'percentage' ? String(coupon.discountValue) : (coupon.discountValue / 100).toString()) : '',
    maxDiscountDollars: coupon?.maxDiscountCents != null ? (coupon.maxDiscountCents / 100).toString() : '',
    appliesTo: coupon?.appliesTo ?? 'purchase',
    hasMinPurchase: coupon?.minPurchaseAmountCents != null,
    minPurchaseDollars: coupon?.minPurchaseAmountCents != null ? (coupon.minPurchaseAmountCents / 100).toString() : '',
    hasPerCustomerLimit: coupon?.perCustomerLimit != null,
    perCustomerLimit: coupon?.perCustomerLimit != null ? String(coupon.perCustomerLimit) : '',
    hasTotalUsageLimit: coupon?.totalUsageLimit != null,
    totalUsageLimit: coupon?.totalUsageLimit != null ? String(coupon.totalUsageLimit) : '',
    startDate,
    startTime,
    endDate,
    endTime,
    active: coupon?.active ?? true,
  }
}

function toLocalDateAndTime(isoString: string): [string, string] {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return [date, time]
}

function combineDateAndTime(date: string, time: string): string | null {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

function RequiredMark() {
  return <span className="text-destructive"> *</span>
}

function CouponFormDialog({
  open,
  onOpenChange,
  coupon,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  coupon: Coupon | null
  onSaved: () => void
}) {
  const { t } = useTranslation('superadminCoupons')
  const [form, setForm] = useState<CouponFormState>(() => couponToFormState(coupon))
  const isRedeemed = false // server enforces this; client just lets the save attempt surface the error

  const [lastCouponId, setLastCouponId] = useState<number | null | undefined>(undefined)
  if (open && coupon?.id !== lastCouponId) {
    setLastCouponId(coupon?.id ?? null)
    setForm(couponToFormState(coupon))
  }

  const startAtIso = combineDateAndTime(form.startDate, form.startTime)
  const endAtIso = combineDateAndTime(form.endDate, form.endTime)
  const dateOrderInvalid = !!(startAtIso && endAtIso && new Date(endAtIso) <= new Date(startAtIso))

  const requiredFieldsFilled =
    form.code.trim().length > 0 &&
    form.discountValue.trim().length > 0 &&
    Number(form.discountValue) > 0 &&
    (form.discountType !== 'percentage' || (form.maxDiscountDollars.trim().length > 0 && Number(form.maxDiscountDollars) > 0)) &&
    form.startDate.length > 0 &&
    form.endDate.length > 0

  const formValid = requiredFieldsFilled && !dateOrderInvalid

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formValid) throw new Error(t('dialog.formInvalid'))
      const body = {
        code: form.code,
        discountType: form.discountType,
        discountValue:
          form.discountType === 'percentage' ? Number(form.discountValue) : Math.round(parseFloat(form.discountValue || '0') * 100),
        maxDiscountCents:
          form.discountType === 'percentage' && form.maxDiscountDollars
            ? Math.round(parseFloat(form.maxDiscountDollars) * 100)
            : null,
        appliesTo: form.appliesTo,
        minPurchaseAmountCents: form.hasMinPurchase && form.minPurchaseDollars ? Math.round(parseFloat(form.minPurchaseDollars) * 100) : null,
        perCustomerLimit: form.hasPerCustomerLimit && form.perCustomerLimit ? Number(form.perCustomerLimit) : null,
        totalUsageLimit: form.hasTotalUsageLimit && form.totalUsageLimit ? Number(form.totalUsageLimit) : null,
        startAt: startAtIso,
        endAt: endAtIso,
        active: form.active,
      }
      if (coupon) {
        return (await api.patch(`/api/coupons/${coupon.id}`, body)).data
      }
      return (await api.post('/api/coupons', body)).data
    },
    onSuccess: () => {
      toast.success(coupon ? t('toast.updated') : t('toast.created'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.saveFailed'))),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? t('dialog.editTitle') : t('dialog.newTitle')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>{t('dialog.code')}<RequiredMark /></Label>
            <Input
              value={form.code}
              placeholder={t('dialog.codePlaceholder')}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('dialog.appliesTo')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.appliesTo === 'purchase' ? 'default' : 'outline'}
                onClick={() => setForm({ ...form, appliesTo: 'purchase' })}
              >
                {t('dialog.appliesToPurchase')}
              </Button>
              <Button
                type="button"
                variant={form.appliesTo === 'recharge' ? 'default' : 'outline'}
                onClick={() => setForm({ ...form, appliesTo: 'recharge' })}
              >
                {t('dialog.appliesToRecharge')}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('dialog.type')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.discountType === 'percentage' ? 'default' : 'outline'}
                onClick={() =>
                  form.discountType !== 'percentage' &&
                  setForm({ ...form, discountType: 'percentage', discountValue: '', maxDiscountDollars: '' })
                }
              >
                {t('dialog.typePercentage')}
              </Button>
              <Button
                type="button"
                variant={form.discountType === 'fixed_amount' ? 'default' : 'outline'}
                onClick={() =>
                  form.discountType !== 'fixed_amount' &&
                  setForm({ ...form, discountType: 'fixed_amount', discountValue: '', maxDiscountDollars: '' })
                }
              >
                {t('dialog.typeFixedAmount')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{form.discountType === 'percentage' ? t('dialog.discountValuePercent') : t('dialog.discountValueUsd')}<RequiredMark /></Label>
              <Input
                type="number"
                min="0"
                step={form.discountType === 'percentage' ? '1' : '0.01'}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              />
            </div>
            {form.discountType === 'percentage' && (
              <div className="space-y-1.5">
                <Label>{t('dialog.maxDiscountUsd')}<RequiredMark /></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maxDiscountDollars}
                  onChange={(e) => setForm({ ...form, maxDiscountDollars: e.target.value })}
                />
              </div>
            )}
          </div>

          <ToggleField
            label={t('dialog.minPurchase')}
            enabled={form.hasMinPurchase}
            onEnabledChange={(v) => setForm({ ...form, hasMinPurchase: v })}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.minPurchaseDollars}
              onChange={(e) => setForm({ ...form, minPurchaseDollars: e.target.value })}
            />
          </ToggleField>

          <ToggleField
            label={t('dialog.perCustomerLimit')}
            enabled={form.hasPerCustomerLimit}
            onEnabledChange={(v) => setForm({ ...form, hasPerCustomerLimit: v })}
          >
            <Input
              type="number"
              min="1"
              step="1"
              value={form.perCustomerLimit}
              onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
            />
          </ToggleField>

          <ToggleField
            label={t('dialog.totalUsageLimit')}
            enabled={form.hasTotalUsageLimit}
            onEnabledChange={(v) => setForm({ ...form, hasTotalUsageLimit: v })}
          >
            <Input
              type="number"
              min="1"
              step="1"
              value={form.totalUsageLimit}
              onChange={(e) => setForm({ ...form, totalUsageLimit: e.target.value })}
            />
          </ToggleField>

          <div className="space-y-1.5">
            <Label>{t('dialog.startAt')}<RequiredMark /></Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                onClick={openPicker}
                onFocus={openPicker}
                className="flex-1 min-w-0"
              />
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                onClick={openPicker}
                onFocus={openPicker}
                className="w-40 flex-shrink-0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('dialog.endAt')}<RequiredMark /></Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                onClick={openPicker}
                onFocus={openPicker}
                className="flex-1 min-w-0"
              />
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                onClick={openPicker}
                onFocus={openPicker}
                className="w-40 flex-shrink-0"
              />
            </div>
            {dateOrderInvalid && <p className="text-xs text-destructive">{t('dialog.endBeforeStartError')}</p>}
          </div>

          {coupon && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>{t('common:active')}</Label>
              <Switch checked={form.active} onCheckedChange={(v: boolean) => setForm({ ...form, active: v })} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !formValid || isRedeemed}>
            {coupon ? t('common:saveChanges') : t('dialog.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ToggleField({
  label,
  enabled,
  onEnabledChange,
  children,
}: {
  label: string
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && children}
    </div>
  )
}

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}

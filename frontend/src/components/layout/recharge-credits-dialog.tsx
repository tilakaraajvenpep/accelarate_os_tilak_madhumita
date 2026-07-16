import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { PlatformSettings } from '@/types/platform-settings'
import type { TenantDashboardPlan } from '@/types/billing'
import type { CouponValidationResult, RechargeCheckoutResult } from '@/types/billing'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

export function RechargeCreditsDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: TenantDashboardPlan | null
}) {
  const { t } = useTranslation('sidebar')

  const { data: settings } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => (await api.get<PlatformSettings>('/api/platform/settings')).data,
    enabled: open,
  })

  const [credits, setCredits] = useState(plan?.aiCredits ?? 0)
  const [couponCode, setCouponCode] = useState('')
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Reset to the plan's default allowance each time the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setCredits(plan?.aiCredits ?? 0)
      setCouponCode('')
      setCouponResult(null)
      setCouponError(null)
    }
  }, [open, plan?.aiCredits])

  const rateCents = settings?.aiCreditRateCents ?? 0
  const grossCents = credits * rateCents
  const discountCents = couponResult?.discountCents ?? 0
  const totalCents = Math.max(0, grossCents - discountCents)

  function handleCreditsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = Math.max(0, Math.floor(Number(e.target.value)))
    setCredits(Number.isFinite(value) ? value : 0)
    setCouponResult(null)
  }

  const couponMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<CouponValidationResult>('/api/coupons/validate', {
          code: couponCode,
          appliesTo: 'recharge',
          grossAmountCents: grossCents,
        })
      ).data,
    onSuccess: (data) => {
      setCouponResult(data)
      setCouponError(null)
    },
    onError: (err) => {
      setCouponResult(null)
      setCouponError(apiError(err, t('planCredits.recharge.couponInvalid')))
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<RechargeCheckoutResult>('/api/tenants/me/recharges/checkout', {
          credits,
          couponCode: couponResult ? couponCode : undefined,
        })
      ).data,
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else toast.error(t('planCredits.recharge.checkoutFailed'))
    },
    onError: (err) => toast.error(apiError(err, t('planCredits.recharge.checkoutFailed'))),
  })

  function handlePayOnline() {
    checkoutMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('planCredits.recharge.title')}</DialogTitle>
          <DialogDescription>{t('planCredits.recharge.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">{t('planCredits.recharge.creditsLabel')}</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={credits}
              onChange={handleCreditsChange}
              className="h-8 w-28 text-right text-sm font-semibold"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">{t('planCredits.recharge.rateLabel')}</span>
            <span className="text-sm font-semibold">
              {formatCents(rateCents)} {t('planCredits.recharge.perCredit')}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                value={couponCode}
                placeholder={t('planCredits.recharge.couponPlaceholder')}
                className="h-8 font-mono text-sm"
                disabled={!!couponResult}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase())
                  setCouponResult(null)
                  setCouponError(null)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant={couponResult ? 'secondary' : 'outline'}
                disabled={!couponResult && (!couponCode || couponMutation.isPending)}
                onClick={() => {
                  if (couponResult) {
                    setCouponResult(null)
                    setCouponCode('')
                    toast.info(t('planCredits.recharge.couponRemoved'))
                  } else {
                    couponMutation.mutate()
                  }
                }}
              >
                {couponResult ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> {t('planCredits.recharge.couponAppliedButton')}
                  </>
                ) : (
                  t('planCredits.recharge.couponApply')
                )}
              </Button>
            </div>
            {couponResult && (
              <p className="text-xs text-green-600">
                {t('planCredits.recharge.couponApplied', { amount: formatCents(couponResult.discountCents) })}
              </p>
            )}
            {couponError && <p className="text-xs text-destructive">{couponError}</p>}
          </div>

          {discountCents > 0 && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('planCredits.recharge.discountLabel')}</span>
              <span className="text-sm font-semibold text-green-600">-{formatCents(discountCents)}</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
            <span className="text-sm font-medium">{t('planCredits.recharge.totalLabel')}</span>
            <span className="text-base font-bold">{formatCents(totalCents)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handlePayOnline} disabled={checkoutMutation.isPending}>
            {t('planCredits.recharge.payOnline')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
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

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  const credits = plan?.aiCredits ?? 0
  const rateCents = settings?.aiCreditRateCents ?? 0
  const totalCents = credits * rateCents

  function handlePayOnline() {
    toast.info(t('planCredits.recharge.paymentComingSoon'))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('planCredits.recharge.title')}</DialogTitle>
          <DialogDescription>{t('planCredits.recharge.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">{t('planCredits.recharge.creditsLabel')}</span>
            <span className="text-sm font-semibold">{credits.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">{t('planCredits.recharge.rateLabel')}</span>
            <span className="text-sm font-semibold">
              {formatCents(rateCents)} {t('planCredits.recharge.perCredit')}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
            <span className="text-sm font-medium">{t('planCredits.recharge.totalLabel')}</span>
            <span className="text-base font-bold">{formatCents(totalCents)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handlePayOnline}>{t('planCredits.recharge.payOnline')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

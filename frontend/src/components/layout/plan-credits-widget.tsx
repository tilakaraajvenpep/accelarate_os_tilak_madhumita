import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import type { TenantDashboardInfo } from '@/types/billing'
import { RechargeCreditsDialog } from './recharge-credits-dialog'

export function PlanCreditsWidget() {
  const { t } = useTranslation('sidebar')
  const [rechargeOpen, setRechargeOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['tenant-dashboard-info'],
    queryFn: async () => (await api.get<TenantDashboardInfo>('/api/tenants/me/dashboard')).data,
  })

  return (
    <div className="mx-2 mb-2 rounded-lg border border-glass-border bg-glass-2 p-3 space-y-2 flex-shrink-0">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/25">{t('planCredits.planLabel')}</p>
        <p className="text-sm font-medium text-ink/80 truncate">{data?.plan?.name ?? t('planCredits.noPlan')}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-ink/80 truncate">
            {(data?.aiCreditsBalance ?? 0).toLocaleString()}
          </span>
          <span className="text-xs text-ink/40">{t('planCredits.creditsLabel')}</span>
        </div>
        <Button size="xs" variant="outline" onClick={() => setRechargeOpen(true)}>
          {t('planCredits.rechargeButton')}
        </Button>
      </div>

      <RechargeCreditsDialog open={rechargeOpen} onOpenChange={setRechargeOpen} plan={data?.plan ?? null} />
    </div>
  )
}

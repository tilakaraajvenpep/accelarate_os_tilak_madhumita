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
    <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 space-y-2 flex-shrink-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
        {t('planCredits.planLabel')}
      </p>
      <p className="text-sm font-semibold text-sidebar-foreground/80 truncate leading-tight">
        {data?.plan?.name ?? t('planCredits.noPlan')}
      </p>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-sidebar-foreground/80 truncate">
            {(data?.aiCreditsBalance ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-sidebar-foreground/40">{t('planCredits.creditsLabel')}</span>
        </div>
        <Button
          size="xs"
          variant="outline"
          className="text-[11px] h-6 px-2 border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent"
          onClick={() => setRechargeOpen(true)}
        >
          {t('planCredits.rechargeButton')}
        </Button>
      </div>
      <RechargeCreditsDialog open={rechargeOpen} onOpenChange={setRechargeOpen} plan={data?.plan ?? null} />
    </div>
  )
}

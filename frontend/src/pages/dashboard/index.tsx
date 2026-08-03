import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
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
import type { CreditPurchaseConfirmation } from '@/types/billing'
import FounderDashboard from './founder'
import AdminDashboard from './admin'
import SuperAdminDashboard from './super-admin'
import MentorDashboard from './mentor'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function RechargeConfirmationDialog() {
  const { t } = useTranslation('sidebar')
  const queryClient = useQueryClient()
  const [confirmation, setConfirmation] = useState<CreditPurchaseConfirmation | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const recharge = params.get('recharge')
    if (!recharge) return

    const creditPurchaseId = params.get('creditPurchaseId')
    window.history.replaceState(null, '', window.location.pathname)

    if (recharge === 'cancelled') {
      toast.error(t('planCredits.recharge.checkoutCancelled'))
      return
    }
    if (recharge === 'success' && creditPurchaseId) {
      api
        .get<CreditPurchaseConfirmation>(`/api/tenants/me/recharges/${creditPurchaseId}`)
        .then(({ data }) => {
          setConfirmation(data)
          queryClient.invalidateQueries({ queryKey: ['tenant-dashboard-info'] })
        })
        .catch(() => toast.error(t('planCredits.recharge.checkoutConfirmationFailed')))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Dialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('planCredits.recharge.confirmationTitle')}</DialogTitle>
          <DialogDescription>{t('planCredits.recharge.confirmationDescription')}</DialogDescription>
        </DialogHeader>
        {confirmation && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('planCredits.recharge.creditsLabel')}</span>
              <span className="text-sm font-semibold">{confirmation.credits.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('planCredits.recharge.totalLabel')}</span>
              <span className="text-sm font-semibold">{formatCents(confirmation.netAmountCents)}</span>
            </div>
            {confirmation.couponCode && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">{t('planCredits.recharge.couponUsed')}</span>
                <span className="text-sm font-mono font-semibold">{confirmation.couponCode}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('common:status')}</span>
              <span className="text-sm font-semibold capitalize">{confirmation.status}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => setConfirmation(null)}>{t('common:close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <>
      <RechargeConfirmationDialog />
      {user?.role === 'super_admin' ? (
        <SuperAdminDashboard />
      ) : user?.role === 'admin' ? (
        <AdminDashboard />
      ) : user?.role === 'mentor' ? (
        <MentorDashboard />
      ) : (
        <FounderDashboard />
      )}
    </>
  )
}

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useTranslation } from '@/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function reset() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error(t('sidebar.changePassword.mismatch'))
      }
      await changePassword(currentPassword, newPassword)
    },
    onSuccess: () => {
      toast.success(t('sidebar.changePassword.toast.success'))
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('sidebar.changePassword.toast.failed'))),
  })

  const canSubmit =
    !!currentPassword && isValidPassword(newPassword) && newPassword === confirmPassword

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('sidebar.changePassword.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('sidebar.changePassword.dialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('sidebar.changePassword.currentPassword')}</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('sidebar.changePassword.newPassword')}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              {t('superAdminAdmins.passwordRequirements')}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('sidebar.changePassword.confirmPassword')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('sidebar.changePassword.save')}
          </Button>
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

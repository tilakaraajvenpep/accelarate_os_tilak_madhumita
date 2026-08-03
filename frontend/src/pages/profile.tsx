import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { User, KeyRound } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import { PASSWORD_PATTERN } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { AuthUser } from '@/types/auth'

function initials(name?: string | null, email?: string) {
  if (name) return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
  return (email?.[0] ?? 'U').toUpperCase()
}

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function ProfilePage() {
  const { t } = useTranslation(['changePassword', 'sidebar'])
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')

  const saveNameMutation = useMutation({
    mutationFn: async () => (await api.patch<AuthUser>('/api/users/me', { name: name.trim() })).data,
    onSuccess: (updated) => {
      updateUser(updated)
      toast.success('Profile updated')
    },
    onError: (err) => toast.error(apiError(err, 'Failed to update profile')),
  })

  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM)
  const [passwordSubmitAttempted, setPasswordSubmitAttempted] = useState(false)

  const changePasswordMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/auth/change-password', {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        })
      ).data,
    onSuccess: () => {
      toast.success(t('changePassword:success'))
      setPasswordForm(EMPTY_PASSWORD_FORM)
      setPasswordSubmitAttempted(false)
    },
    onError: (err) => toast.error(apiError(err, t('changePassword:failure'))),
  })

  function handleChangePassword() {
    setPasswordSubmitAttempted(true)
    if (!passwordForm.currentPassword) {
      toast.error(t('changePassword:currentPasswordRequired'))
      return
    }
    if (!PASSWORD_PATTERN.test(passwordForm.newPassword)) {
      toast.error(t('changePassword:passwordHint'))
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('changePassword:passwordsDontMatch'))
      return
    }
    changePasswordMutation.mutate()
  }

  const nameChanged = name.trim().length > 0 && name.trim() !== (user?.name ?? '')

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account details and password.</p>
      </div>

      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-base font-semibold">{initials(user?.name, user?.email)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{user?.role ? t(`sidebar:roleLabels.${user.role}`) : ''}</p>
            </div>
          </div>

          <div className="space-y-1.5 max-w-sm">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>

          <Button onClick={() => saveNameMutation.mutate()} disabled={!nameChanged || saveNameMutation.isPending}>
            Save changes
          </Button>
        </div>
      </div>

      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">{t('changePassword:title')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t('changePassword:description')}</p>
          </div>
        </div>
        <div className="p-4 space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label>{t('changePassword:currentPassword')}</Label>
            <PasswordInput
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('changePassword:newPassword')}</Label>
            <PasswordInput
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{t('changePassword:passwordHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('changePassword:confirmNewPassword')}</Label>
            <PasswordInput
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
            {passwordSubmitAttempted && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-destructive">{t('changePassword:passwordsDontMatch')}</p>
            )}
          </div>
          <Button onClick={handleChangePassword} disabled={changePasswordMutation.isPending}>
            {t('changePassword:submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}

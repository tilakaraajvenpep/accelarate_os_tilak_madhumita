import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { PASSWORD_PATTERN, PASSWORD_HINT } from '@/lib/validation'
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

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)

  function handleOpenChange(next: boolean) {
    if (next) setForm(EMPTY_FORM)
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/auth/change-password', {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        })
      ).data,
    onSuccess: () => {
      toast.success('Password changed')
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to change password')),
  })

  const canSubmit =
    !!form.currentPassword && PASSWORD_PATTERN.test(form.newPassword) && form.newPassword === form.confirmPassword

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            Change password
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

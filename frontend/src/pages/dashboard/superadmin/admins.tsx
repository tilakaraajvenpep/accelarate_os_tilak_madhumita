import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cleanErrorMessage } from '@/lib/api-error'

import { useAuth } from '@/context/auth-context'
import { useConfirm } from '@/components/confirm-dialog'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useListControls } from '@/hooks/use-list-controls'
import { Loader } from '@/components/ui/loader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
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
import type { SuperAdmin } from '@/types/admin'
import { PASSWORD_PATTERN } from '@/lib/validation'

export default function SuperAdminsPage() {
  const { t } = useTranslation('superadminAdmins')
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const confirm = useConfirm()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SuperAdmin | null>(null)

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['super-admins'],
    queryFn: async () => (await api.get<SuperAdmin[]>('/api/super-admins')).data,
  })

  const controls = useListControls(admins, {
    searchFields: (admin) => [admin.name, admin.email],
    statusValue: (admin) => admin.active,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['super-admins'] })
  }

  const toggleActiveMutation = useMutation({
    mutationFn: async (params: { id: number; active: boolean }) =>
      (await api.patch(`/api/super-admins/${params.id}/active`, { active: params.active })).data as SuperAdmin,
    onSuccess: (updated) => {
      toast.success(updated.active ? t('toasts.activated') : t('toasts.deactivated'))
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, t('toasts.statusUpdateFailed'))),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/super-admins/${id}`)).data,
    onSuccess: () => {
      toast.success(t('toasts.deleteSuccess'))
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, t('toasts.deleteFailed'))),
  })

  async function handleDelete(admin: SuperAdmin) {
    const ok = await confirm({
      title: t('deleteDialog.title'),
      description: t('deleteDialog.description', { name: admin.name || admin.email }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (!ok) return
    deleteMutation.mutate(admin.id)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('page.description')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t('page.newButton')}
        </Button>
      </div>

      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('table.sectionTitle')}</h2>
        </div>
        <div className="px-6 py-3 border-b">
          <ListToolbar controls={controls} searchPlaceholder={t('common:search')} activeLabel={t('common:active')} inactiveLabel={t('common:inactive')} />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:name')}</TableHead>
                <TableHead>{t('common:email')}</TableHead>
                <TableHead className="text-center">{t('common:status')}</TableHead>
                <TableHead className="text-center">{t('common:actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10">
                    <Loader />
                  </TableCell>
                </TableRow>
              ) : (
                controls.paged.map((admin) => {
                  const isSelf = admin.id === currentUser?.id
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-3">
                          <Badge variant={admin.active ? 'success' : 'secondary'}>
                            {admin.active ? t('common:active') : t('common:inactive')}
                          </Badge>
                          <Switch
                            checked={admin.active}
                            disabled={isSelf || toggleActiveMutation.isPending}
                            title={isSelf ? t('table.selfStatusTooltip') : undefined}
                            onCheckedChange={(checked: boolean) =>
                              toggleActiveMutation.mutate({ id: admin.id, active: checked })
                            }
                          />
                          {!admin.emailVerified && (
                            <Badge variant="outline">
                              {t('table.unverified')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="ghost" size="icon-sm" title={t('common:edit')} onClick={() => setEditing(admin)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={isSelf ? t('table.selfDeleteTooltip') : t('common:delete')}
                            disabled={isSelf || deleteMutation.isPending}
                            onClick={() => handleDelete(admin)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
              {!isLoading && controls.paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 py-3 border-t">
          <ListPagination controls={controls} />
        </div>
      </div>

      <CreateSuperAdminDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <EditSuperAdminDialog admin={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={invalidate} />
    </div>
  )
}

type CreateStep = 'form' | 'otp'

interface CreateForm {
  name: string
  email: string
  password: string
}

const EMPTY_CREATE_FORM: CreateForm = { name: '', email: '', password: '' }

function CreateSuperAdminDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { t } = useTranslation('superadminAdmins')
  const [step, setStep] = useState<CreateStep>('form')
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE_FORM)
  const [otp, setOtp] = useState('')

  function handleOpenChange(next: boolean) {
    // Reset on every close (not just the next open) so unsaved input never lingers into the next session.
    setStep('form')
    setForm(EMPTY_CREATE_FORM)
    setOtp('')
    onOpenChange(next)
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/api/super-admins', {
          name: form.name || undefined,
          email: form.email,
          password: form.password,
        })
      ).data as { emailSent: boolean }
    },
    onSuccess: (data) => {
      toast.success(
        data.emailSent
          ? t('createDialog.otp.otpSent', { email: form.email })
          : t('createDialog.otp.otpSendFailed'),
      )
      setStep('otp')
    },
    onError: (err) => toast.error(apiError(err, t('createDialog.errors.createFailed'))),
  })

  const verifyMutation = useMutation({
    mutationFn: async () => (await api.post('/api/super-admins/verify-otp', { email: form.email, code: otp })).data,
    onSuccess: () => {
      toast.success(t('createDialog.otp.verifiedSuccess'))
      onCreated()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('createDialog.otp.verifyFailed'))),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('createDialog.title')}</DialogTitle>
              <DialogDescription>{t('createDialog.description')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('createDialog.form.nameLabel')}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label required>{t('createDialog.form.emailLabel')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label required>{t('createDialog.form.passwordLabel')}</Label>
                <PasswordInput
                  placeholder={t('createDialog.form.passwordPlaceholder')}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t('createDialog.form.passwordHint')}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('common:cancel')}
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.email || !PASSWORD_PATTERN.test(form.password)}
              >
                {t('createDialog.form.submit')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'otp' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('createDialog.otp.title')}</DialogTitle>
              <DialogDescription>{t('createDialog.otp.description', { email: form.email })}</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label>{t('createDialog.otp.label')}</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder={t('createDialog.otp.placeholder')}
                className="text-center text-2xl tracking-[0.4em] font-mono"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('form')}>
                {t('common:back')}
              </Button>
              <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending || otp.length !== 6}>
                {t('createDialog.otp.submit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditSuperAdminDialog({
  admin,
  onOpenChange,
  onSaved,
}: {
  admin: SuperAdmin | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { t } = useTranslation('superadminAdmins')
  const [form, setForm] = useState({ name: '', email: '' })

  function formFromAdmin() {
    return { name: admin?.name ?? '', email: admin?.email ?? '' }
  }

  const [lastAdminId, setLastAdminId] = useState<number | null | undefined>(undefined)
  if (admin && admin.id !== lastAdminId) {
    setLastAdminId(admin.id)
    setForm(formFromAdmin())
  }

  function handleOpenChange(next: boolean) {
    if (!next) setForm(formFromAdmin())
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admin) throw new Error('No super admin selected')
      return (await api.patch(`/api/super-admins/${admin.id}`, { name: form.name, email: form.email })).data
    },
    onSuccess: () => {
      toast.success(t('editDialog.updatedSuccess'))
      onSaved()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('editDialog.saveFailed'))),
  })

  return (
    <Dialog open={!!admin} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editDialog.title')}</DialogTitle>
          <DialogDescription>{t('editDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('editDialog.nameLabel')}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label required>{t('editDialog.emailLabel')}</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-muted-foreground">{t('editDialog.emailHint')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.email}>
            {t('common:saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function apiError(err: unknown, fallback: string) {
  const msg =
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  return cleanErrorMessage(msg, fallback)
}

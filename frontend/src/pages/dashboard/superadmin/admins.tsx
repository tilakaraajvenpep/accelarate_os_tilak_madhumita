import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
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
import type { SuperAdmin } from '@/types/admin'
import { PASSWORD_PATTERN } from '@/lib/validation'

export default function SuperAdminsPage() {
  const { t } = useTranslation('superadminAdmins')
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SuperAdmin | null>(null)
  const [deleting, setDeleting] = useState<SuperAdmin | null>(null)

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['super-admins'],
    queryFn: async () => (await api.get<SuperAdmin[]>('/api/super-admins')).data,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['super-admins'] })
  }

  const toggleActiveMutation = useMutation({
    mutationFn: async (params: { id: number; active: boolean }) =>
      (await api.patch(`/api/super-admins/${params.id}/active`, { active: params.active })).data,
    onSuccess: () => {
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, t('toasts.statusUpdateFailed'))),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/super-admins/${id}`)).data,
    onSuccess: () => {
      toast.success(t('toasts.deleteSuccess'))
      invalidate()
      setDeleting(null)
    },
    onError: (err) => toast.error(apiError(err, t('toasts.deleteFailed'))),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('page.description')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t('page.newButton')}
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('table.sectionTitle')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common:name')}</TableHead>
              <TableHead>{t('common:email')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => {
              const isSelf = admin.id === currentUser?.id
              return (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.active ? 'default' : 'secondary'}>
                      {admin.active ? t('common:active') : t('common:inactive')}
                    </Badge>
                    {!admin.emailVerified && (
                      <Badge variant="outline" className="ml-2">
                        {t('table.unverified')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-xs text-muted-foreground">{t('table.activeSwitchLabel')}</span>
                      <Switch
                        checked={admin.active}
                        disabled={isSelf || toggleActiveMutation.isPending}
                        title={isSelf ? t('table.selfStatusTooltip') : undefined}
                        onCheckedChange={(checked: boolean) =>
                          toggleActiveMutation.mutate({ id: admin.id, active: checked })
                        }
                      />
                      <Button variant="ghost" size="icon-sm" title={t('common:edit')} onClick={() => setEditing(admin)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={isSelf ? t('table.selfDeleteTooltip') : t('common:delete')}
                        disabled={isSelf || deleteMutation.isPending}
                        onClick={() => setDeleting(admin)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {!isLoading && admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  {t('table.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSuperAdminDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <EditSuperAdminDialog admin={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={invalidate} />
      <DeleteSuperAdminDialog
        admin={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        pending={deleteMutation.isPending}
      />
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
    if (next) {
      setStep('form')
      setForm(EMPTY_CREATE_FORM)
      setOtp('')
    }
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
                <Label>{t('createDialog.form.emailLabel')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('createDialog.form.passwordLabel')}</Label>
                <Input
                  type="password"
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
  const [lastAdminId, setLastAdminId] = useState<number | null | undefined>(undefined)

  if (admin && admin.id !== lastAdminId) {
    setLastAdminId(admin.id)
    setForm({ name: admin.name ?? '', email: admin.email })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admin) throw new Error('No super admin selected')
      return (await api.patch(`/api/super-admins/${admin.id}`, { name: form.name, email: form.email })).data
    },
    onSuccess: () => {
      toast.success(t('editDialog.updatedSuccess'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('editDialog.saveFailed'))),
  })

  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
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
            <Label>{t('editDialog.emailLabel')}</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-muted-foreground">{t('editDialog.emailHint')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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

function DeleteSuperAdminDialog({
  admin,
  onOpenChange,
  onConfirm,
  pending,
}: {
  admin: SuperAdmin | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  const { t } = useTranslation('superadminAdmins')
  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
          <DialogDescription>
            {admin && t('deleteDialog.description', { name: admin.name || admin.email })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {t('common:delete')}
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

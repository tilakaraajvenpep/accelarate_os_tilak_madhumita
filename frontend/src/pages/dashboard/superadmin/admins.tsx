import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ShieldCheck, Trash2, Pencil, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import { useTranslation } from '@/i18n/I18nProvider'
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
import type { AuthUser } from '@/types/auth'

type SuperAdminRow = AuthUser & { disabled: boolean }

export default function SuperAdminsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<SuperAdminRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SuperAdminRow | null>(null)

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['super-admins'],
    queryFn: async () => (await api.get<SuperAdminRow[]>('/api/platform/super-admins')).data,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['super-admins'] })
  }

  const disableMutation = useMutation({
    mutationFn: async ({ id, disabled }: { id: number; disabled: boolean }) =>
      (await api.patch(`/api/platform/super-admins/${id}/disabled`, { disabled })).data,
    onSuccess: (_data, variables) => {
      toast.success(variables.disabled ? t('superAdminAdmins.toast.disabled') : t('superAdminAdmins.toast.enabled'))
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, t('superAdminAdmins.toast.updateFailed'))),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/platform/super-admins/${id}`)).data,
    onSuccess: () => {
      toast.success(t('superAdminAdmins.toast.deleted'))
      setPendingDelete(null)
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, t('superAdminAdmins.toast.deleteFailed'))),
  })

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('superAdminAdmins.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('superAdminAdmins.subtitle')}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t('superAdminAdmins.newSuperAdmin')}
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('superAdminAdmins.currentSuperAdmins')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('superAdminAdmins.tableName')}</TableHead>
              <TableHead>{t('superAdminAdmins.tableEmail')}</TableHead>
              <TableHead>{t('superAdminAdmins.tableStatus')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => {
              const isSelf = admin.id === currentUser?.id
              return (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name || '—'}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.disabled ? 'secondary' : 'default'}>
                      {admin.disabled ? t('superAdminAdmins.disabled') : t('superAdminAdmins.active')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <div
                        className="flex items-center gap-2"
                        title={isSelf ? t('superAdminAdmins.cannotDisableSelf') : admin.disabled ? t('superAdminAdmins.enableSignIn') : t('superAdminAdmins.disableSignIn')}
                      >
                        <span className="text-xs text-muted-foreground">{admin.disabled ? t('superAdminAdmins.disabled') : t('superAdminAdmins.active')}</span>
                        <Switch
                          checked={!admin.disabled}
                          disabled={isSelf || disableMutation.isPending}
                          onCheckedChange={(checked: boolean) =>
                            disableMutation.mutate({ id: admin.id, disabled: !checked })
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('superAdminAdmins.edit')}
                        onClick={() => setEditingAdmin(admin)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={isSelf ? t('superAdminAdmins.cannotDeleteSelf') : t('superAdminAdmins.delete')}
                        disabled={isSelf}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(admin)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {!isLoading && admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  {t('superAdminAdmins.noSuperAdminsYet')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSuperAdminDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={invalidate}
      />

      <EditSuperAdminDialog
        admin={editingAdmin}
        onOpenChange={(open) => !open && setEditingAdmin(null)}
        onUpdated={invalidate}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('superAdminAdmins.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('superAdminAdmins.deleteConfirmDesc', { email: pendingDelete?.email ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type Step = 'details' | 'verify'

function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

function CreateSuperAdminDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')

  function reset() {
    setStep('details')
    setName('')
    setEmail('')
    setPassword('')
    setCode('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const requestOtpMutation = useMutation({
    mutationFn: async () => (await api.post('/api/platform/super-admins/request-otp', { email, name: name || null })).data,
    onSuccess: () => {
      toast.success(t('superAdminAdmins.toast.codeSent', { email }))
      setStep('verify')
    },
    onError: (err) => toast.error(apiError(err, t('superAdminAdmins.toast.sendCodeFailed'))),
  })

  const verifyOtpMutation = useMutation({
    mutationFn: async () => (await api.post('/api/platform/super-admins/verify-otp', { email, code, password })).data,
    onSuccess: () => {
      toast.success(t('superAdminAdmins.toast.created'))
      onCreated()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('superAdminAdmins.toast.verifyFailed'))),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'details' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('superAdminAdmins.newSuperAdminTitle')}</DialogTitle>
              <DialogDescription>
                {t('superAdminAdmins.newSuperAdminDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('superAdminAdmins.nameOptional')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.email')}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@accelerateos.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.password')}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  {t('superAdminAdmins.passwordRequirements')}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => requestOtpMutation.mutate()}
                disabled={!email || !isValidPassword(password) || requestOtpMutation.isPending}
              >
                {requestOtpMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('superAdminAdmins.sendVerificationCode')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('superAdminAdmins.verifyEmailTitle')}</DialogTitle>
              <DialogDescription>
                {t('superAdminAdmins.verifyEmailDesc', { email })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('superAdminAdmins.verificationCode')}</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="text-center text-2xl tracking-[0.4em] font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('details')}>
                {t('common.back')}
              </Button>
              <Button
                onClick={() => verifyOtpMutation.mutate()}
                disabled={code.length !== 6 || verifyOtpMutation.isPending}
              >
                {verifyOtpMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('superAdminAdmins.verifyAndCreate')}
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
  onUpdated,
}: {
  admin: SuperAdminRow | null
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [lastAdminId, setLastAdminId] = useState<number | null | undefined>(undefined)
  if (admin && admin.id !== lastAdminId) {
    setLastAdminId(admin.id)
    setName(admin.name || '')
    setEmail(admin.email)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admin) throw new Error('No super admin selected')
      return (
        await api.patch(`/api/platform/super-admins/${admin.id}`, {
          name: name || null,
          email,
        })
      ).data
    },
    onSuccess: () => {
      toast.success(t('superAdminAdmins.toast.updated'))
      onUpdated()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('superAdminAdmins.toast.updateFailed'))),
  })

  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('superAdminAdmins.editSuperAdminTitle')}</DialogTitle>
          <DialogDescription>{t('superAdminAdmins.editSuperAdminDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('superAdminAdmins.nameOptional')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.email')}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.saveChanges')}
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

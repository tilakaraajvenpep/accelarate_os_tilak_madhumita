import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Building2, Dices, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type { Tenant, OrgType } from '@/types/billing'

const ORG_TYPES: { key: string; value: OrgType }[] = [
  { key: 'university', value: 'university' },
  { key: 'corporate', value: 'corporate' },
  { key: 'vcBacked', value: 'vc_backed' },
  { key: 'government', value: 'government' },
  { key: 'independent', value: 'independent' },
  { key: 'other', value: 'other' },
]

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function TenantsAdminPage() {
  const { t } = useTranslation('superadminTenants')
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  const deleteMutation = useMutation({
    mutationFn: async (tenantId: number) => (await api.delete(`/api/tenants/${tenantId}`)).data,
    onSuccess: () => {
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.deleteFailed'))),
  })

  function handleDelete(tenant: Tenant) {
    const confirmed = window.confirm(t('confirmDelete', { name: tenant.name }))
    if (!confirmed) return
    deleteMutation.mutate(tenant.id)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('page.subtitle')}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t('page.createButton')}
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('table.cardTitle')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common:name')}</TableHead>
              <TableHead>{t('table.slug')}</TableHead>
              <TableHead>{t('table.orgType')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
              <TableHead>{t('common:createdAt')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell className="text-muted-foreground">{tenant.slug}</TableCell>
                <TableCell>{tenant.orgType ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={tenant.suspended ? 'secondary' : 'default'}>
                    {tenant.suspended ? t('table.suspended') : t('common:active')}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={t('table.deleteButtonTitle')}
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(tenant)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {t('table.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['tenants'] })}
      />
    </div>
  )
}

interface CreateTenantForm {
  name: string
  orgType: OrgType | ''
  website: string
  slug: string
  slugTouched: boolean
  adminEmail: string
  adminName: string
  adminPassword: string
}

const EMPTY_FORM: CreateTenantForm = {
  name: '',
  orgType: '',
  website: '',
  slug: '',
  slugTouched: false,
  adminEmail: '',
  adminName: '',
  adminPassword: '',
}

type DialogStep = 'details' | 'verify'

function CreateTenantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { t } = useTranslation('superadminTenants')
  const [form, setForm] = useState<CreateTenantForm>(EMPTY_FORM)
  const [step, setStep] = useState<DialogStep>('details')
  const [otpCode, setOtpCode] = useState('')

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(EMPTY_FORM)
      setStep('details')
      setOtpCode('')
    }
    onOpenChange(next)
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }))
  }

  const sendCodeMutation = useMutation({
    mutationFn: async () => (await api.post('/api/tenants/send-verification-code', { adminEmail: form.adminEmail, name: form.name })).data,
    onSuccess: () => {
      toast.success(t('toast.verificationSent', { email: form.adminEmail }))
      setStep('verify')
    },
    onError: (err) => toast.error(apiError(err, t('toast.sendCodeFailed'))),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/api/tenants', {
          name: form.name,
          orgType: form.orgType || undefined,
          website: form.website || undefined,
          slug: form.slug || undefined,
          adminEmail: form.adminEmail,
          adminName: form.adminName,
          adminPassword: form.adminPassword,
          otpCode,
        })
      ).data
    },
    onSuccess: () => {
      toast.success(t('toast.created', { name: form.name }))
      onCreated()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.createFailed'))),
  })

  const detailsValid = !!form.name && !!form.adminEmail && !!form.adminName && form.adminPassword.length >= 8

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>
            {step === 'details'
              ? t('createDialog.descriptionDetails')
              : t('createDialog.descriptionVerify', { email: form.adminEmail })}
          </DialogDescription>
        </DialogHeader>

        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('createDialog.orgName')}</Label>
              <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.slug')}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value), slugTouched: true })}
              />
              <p className="text-xs text-muted-foreground">{t('createDialog.slugHint', { slug: form.slug || '…' })}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.orgType')}</Label>
              <Select value={form.orgType} onValueChange={(v) => setForm({ ...form, orgType: (v as OrgType) ?? '' })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('createDialog.orgTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((ot) => (
                    <SelectItem key={ot.value} value={ot.value}>
                      {t(`orgTypes.${ot.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.website')}</Label>
              <Input
                type="url"
                placeholder={t('createDialog.websitePlaceholder')}
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.adminName')}</Label>
              <Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.adminEmail')}</Label>
              <Input
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.adminPassword')}</Label>
              <div className="flex gap-2">
                <Input
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  placeholder={t('createDialog.adminPasswordPlaceholder')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={t('createDialog.generatePasswordTitle')}
                  onClick={() => setForm({ ...form, adminPassword: generatePassword() })}
                >
                  <Dices className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('createDialog.passwordHint')}
              </p>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('createDialog.verificationCode')}</Label>
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="text-center text-2xl tracking-[0.4em] font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{t('createDialog.codeExpiry')}</p>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => sendCodeMutation.mutate()}
              disabled={sendCodeMutation.isPending}
            >
              {t('createDialog.resendCode')}
            </button>
          </div>
        )}

        <DialogFooter>
          {step === 'details' ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('common:cancel')}
              </Button>
              <Button onClick={() => sendCodeMutation.mutate()} disabled={sendCodeMutation.isPending || !detailsValid}>
                {t('createDialog.sendCode')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('details')}>
                {t('common:back')}
              </Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || otpCode.length < 1}>
                {t('createDialog.verifyAndCreate')}
              </Button>
            </>
          )}
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

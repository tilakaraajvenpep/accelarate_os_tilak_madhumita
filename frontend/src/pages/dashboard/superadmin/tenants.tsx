import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Building2, Dices, Trash2, Globe, Calendar, CreditCard } from 'lucide-react'
import { api } from '@/lib/api'
import { cleanErrorMessage } from '@/lib/api-error'

import { useConfirm } from '@/components/confirm-dialog'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useListControls } from '@/hooks/use-list-controls'
import { Loader } from '@/components/ui/loader'
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
  for (let i = 0; i < 14; i++) out += chars[HTMLOverlayRandom(chars.length)]
  return out
}

function HTMLOverlayRandom(max: number) {
  return Math.floor(Math.random() * max)
}

export default function TenantsAdminPage() {
  const { t } = useTranslation('superadminTenants')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsTenant, setDetailsTenant] = useState<Tenant | null>(null)

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  const controls = useListControls(tenants, {
    searchFields: (tenant) => [tenant.name, tenant.slug],
    statusValue: (tenant) => !tenant.suspended,
  })

  const deleteMutation = useMutation({
    mutationFn: async (tenantId: number) => (await api.delete(`/api/tenants/${tenantId}`)).data,
    onSuccess: () => {
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.deleteFailed'))),
  })

  async function handleDelete(tenant: Tenant) {
    const ok = await confirm({
      title: t('confirmDeleteTitle'),
      description: t('confirmDelete', { name: tenant.name }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (!ok) return
    deleteMutation.mutate(tenant.id)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('page.subtitle')}</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-9 px-4 font-semibold gap-1.5"
        >
          <Plus className="h-4 w-4" /> {t('page.createButton')}
        </Button>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('table.cardTitle')}</h2>
        </div>
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <ListToolbar controls={controls} searchPlaceholder={t('common:search')} activeLabel={t('common:active')} inactiveLabel={t('table.suspended')} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">
                <th className="px-5 py-3">{t('common:name')}</th>
                <th className="px-5 py-3">{t('table.slug')}</th>
                <th className="px-5 py-3">{t('table.orgType')}</th>
                <th className="px-5 py-3">{t('common:status')}</th>
                <th className="px-5 py-3">{t('common:createdAt')}</th>
                <th className="px-5 py-3 text-center">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Loader />
                  </td>
                </tr>
              ) : (
                controls.paged.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setDetailsTenant(tenant)}
                  >
                    <td className="px-5 py-3.5 font-medium text-foreground">{tenant.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{tenant.slug}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{tenant.orgType ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        tenant.suspended
                          ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
                          : 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
                      }`}>
                        {tenant.suspended ? t('table.suspended') : t('common:active')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t('table.deleteButtonTitle')}
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(tenant)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!isLoading && controls.paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border">
          <ListPagination controls={controls} />
        </div>
      </div>

      <CreateTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['tenants'] })}
      />

      <TenantDetailsDialog tenant={detailsTenant} onOpenChange={(open) => !open && setDetailsTenant(null)} />
    </div>
  )
}

function TenantDetailsDialog({ tenant, onOpenChange }: { tenant: Tenant | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('superadminTenants')
  return (
    <Dialog open={!!tenant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tenant?.name}</DialogTitle>
          <DialogDescription>{t('detailsDialog.subtitle')}</DialogDescription>
        </DialogHeader>
        {tenant && (
          <div className="space-y-0.5 border border-border rounded-lg overflow-hidden bg-card">
            <DetailRow icon={Globe} label={t('table.slug')} value={tenant.slug} />
            <DetailRow icon={Building2} label={t('table.orgType')} value={tenant.orgType ?? '—'} />
            <DetailRow icon={Globe} label={t('createDialog.website')} value={tenant.website ?? '—'} />
            <DetailRow
              icon={Calendar}
              label={t('common:status')}
              value={
                <Badge variant={tenant.suspended ? 'secondary' : 'default'} className="h-5 text-xs font-semibold px-2">
                  {tenant.suspended ? t('table.suspended') : t('common:active')}
                </Badge>
              }
            />
            <DetailRow icon={Calendar} label={t('common:createdAt')} value={new Date(tenant.createdAt).toLocaleDateString()} />
            <DetailRow icon={CreditCard} label={t('detailsDialog.plan')} value={tenant.plan?.name ?? '—'} />
            {tenant.subscription && <DetailRow icon={CreditCard} label={t('common:status')} value={tenant.subscription.status} />}
            <DetailRow
              icon={Building2}
              label={t('detailsDialog.foundersUsed')}
              value={`${tenant.foundersUsed}${tenant.plan?.foundersLimit != null ? ` / ${tenant.plan.foundersLimit}` : ''}`}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common:close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border last:border-b-0 py-3 px-4 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground font-medium">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="font-semibold text-foreground">{value}</span>
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
    setForm(EMPTY_FORM)
    setStep('details')
    setOtpCode('')
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
              <Label required>{t('createDialog.orgName')}</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.slug')}</Label>
              <Input
                className="h-9 text-sm"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value), slugTouched: true })}
              />
              <p className="text-xs text-muted-foreground">
                {t('createDialog.slugHint', { slug: form.slug || '…', baseDomain: import.meta.env.VITE_BASE_DOMAIN })}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('createDialog.orgType')}</Label>
              <Select value={form.orgType} onValueChange={(v) => setForm({ ...form, orgType: (v as OrgType) ?? '' })}>
                <SelectTrigger className="w-full h-9 text-sm">
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
                className="h-9 text-sm"
                type="url"
                placeholder={t('createDialog.websitePlaceholder')}
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label required>{t('createDialog.adminName')}</Label>
              <Input className="h-9 text-sm" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label required>{t('createDialog.adminEmail')}</Label>
              <Input
                className="h-9 text-sm"
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label required>{t('createDialog.adminPassword')}</Label>
              <div className="flex gap-2">
                <Input
                  className="h-9 text-sm"
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  placeholder={t('createDialog.adminPasswordPlaceholder')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
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
              <Label required>{t('createDialog.verificationCode')}</Label>
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="h-10 text-center text-xl tracking-[0.4em] font-mono"
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
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                {t('common:cancel')}
              </Button>
              <Button size="sm" onClick={() => sendCodeMutation.mutate()} disabled={sendCodeMutation.isPending || !detailsValid}>
                {t('createDialog.sendCode')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep('details')}>
                {t('common:back')}
              </Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || otpCode.length < 1}>
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
  const msg =
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  return cleanErrorMessage(msg, fallback)
}

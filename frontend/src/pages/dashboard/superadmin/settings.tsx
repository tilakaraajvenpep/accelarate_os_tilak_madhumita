import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, KeyRound, Mail, ChevronDown, Sparkles, Bot, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

type AiProvider = 'openai' | 'anthropic'

interface AiProviderConfig {
  id: number
  provider: AiProvider
  model: string
  apiKeyLastFour: string
  enabled: boolean
  createdAt: string
}

interface TenantEmailRow {
  id: number
  name: string
  emailServiceEnabled: boolean
}

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude (Anthropic)',
}

const PROVIDER_STYLES: Record<AiProvider, { icon: typeof Bot; className: string }> = {
  openai: { icon: Bot, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  anthropic: { icon: Sparkles, className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
}

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t('superAdminSettings.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('superAdminSettings.subtitle')}</p>
      </div>

      <AiKeysSection />
      <TenantEmailServiceSection />
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card shadow-sm divide-y overflow-hidden">{children}</div>
}

function EmptyRow({ icon: Icon, text }: { icon: typeof KeyRound; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 border-border"
      />
    </div>
  )
}

function AiKeysSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AiProviderConfig | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AiProviderConfig | null>(null)
  const [search, setSearch] = useState('')

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['ai-provider-configs'],
    queryFn: async () => (await api.get<AiProviderConfig[]>('/api/ai-configs')).data,
  })

  const filteredConfigs = configs.filter((config) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return (
      PROVIDER_LABELS[config.provider].toLowerCase().includes(query) ||
      config.model.toLowerCase().includes(query)
    )
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ai-provider-configs'] })
  }

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) =>
      (await api.patch(`/api/ai-configs/${id}/enabled`, { enabled })).data,
    onSuccess: (_data, variables) => {
      toast.success(variables.enabled ? t('superAdminSettings.aiKeys.toast.enabled') : t('superAdminSettings.aiKeys.toast.disabled'))
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, t('superAdminSettings.aiKeys.toast.updateFailed'))),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/ai-configs/${id}`)).data,
    onSuccess: () => {
      toast.success(t('superAdminSettings.aiKeys.toast.deleted'))
      setPendingDelete(null)
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, t('superAdminSettings.aiKeys.toast.deleteFailed'))),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> {t('superAdminSettings.aiKeys.title')}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {t('superAdminSettings.aiKeys.subtitle')}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4" /> {t('superAdminSettings.aiKeys.addKey')}
        </Button>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('superAdminSettings.aiKeys.searchPlaceholder')}
      />

      <SectionCard>
        {filteredConfigs.map((config) => {
          const { icon: ProviderIcon, className } = PROVIDER_STYLES[config.provider]
          return (
            <div key={config.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', className)}>
                  <ProviderIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{PROVIDER_LABELS[config.provider]}</p>
                  <p className="text-xs text-muted-foreground truncate">{config.model}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Badge variant={config.enabled ? 'default' : 'secondary'} className="w-[70px] justify-center">
                    {config.enabled ? t('superAdminSettings.aiKeys.active') : t('superAdminSettings.aiKeys.disabled')}
                  </Badge>
                  <Switch
                    checked={config.enabled}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(checked: boolean) =>
                      toggleMutation.mutate({ id: config.id, enabled: checked })
                    }
                  />
                </div>

                <div className="h-6 w-px bg-border" />

                <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={t('superAdminSettings.aiKeys.edit')}
                    className="hover:bg-background hover:shadow-sm"
                    onClick={() => setEditingConfig(config)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={t('superAdminSettings.aiKeys.delete')}
                    className="text-destructive hover:text-destructive hover:bg-background hover:shadow-sm"
                    onClick={() => setPendingDelete(config)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
        {!isLoading && configs.length === 0 && (
          <EmptyRow icon={KeyRound} text={t('superAdminSettings.aiKeys.noneYet')} />
        )}
        {!isLoading && configs.length > 0 && filteredConfigs.length === 0 && (
          <EmptyRow icon={Search} text={t('superAdminSettings.aiKeys.noResults')} />
        )}
      </SectionCard>

      <AddAiKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={invalidate}
      />

      <EditAiKeyDialog
        config={editingConfig}
        onOpenChange={(open) => !open && setEditingConfig(null)}
        onSaved={invalidate}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('superAdminSettings.aiKeys.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('superAdminSettings.aiKeys.deleteConfirmDesc', {
                provider: pendingDelete ? PROVIDER_LABELS[pendingDelete.provider] : '',
                model: pendingDelete?.model ?? '',
              })}
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

function AddAiKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<AiProvider | ''>('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')

  const { data: modelsByProvider } = useQuery({
    queryKey: ['ai-provider-models'],
    queryFn: async () => (await api.get<Record<AiProvider, string[]>>('/api/ai-configs/models')).data,
    enabled: open,
  })

  function reset() {
    setProvider('')
    setModel('')
    setApiKey('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: async () => (await api.post('/api/ai-configs', { provider, model, apiKey })).data,
    onSuccess: () => {
      toast.success(t('superAdminSettings.aiKeys.toast.created'))
      onCreated()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('superAdminSettings.aiKeys.toast.createFailed'))),
  })

  const models = provider ? modelsByProvider?.[provider] ?? [] : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('superAdminSettings.aiKeys.addDialogTitle')}</DialogTitle>
          <DialogDescription>{t('superAdminSettings.aiKeys.addDialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => {
              const { icon: ProviderIcon, className } = PROVIDER_STYLES[p]
              const selected = provider === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setProvider(p)
                    setModel('')
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', className)}>
                    <ProviderIcon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{PROVIDER_LABELS[p]}</span>
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <Label>{t('superAdminSettings.aiKeys.model')}</Label>
            <Select value={model} onValueChange={(v) => setModel(v ?? '')}>
              <SelectTrigger className="w-full" disabled={!provider}>
                <SelectValue placeholder={provider ? t('superAdminSettings.aiKeys.selectModel') : t('superAdminSettings.aiKeys.selectProviderFirst')} />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('superAdminSettings.aiKeys.apiKey')}</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
              disabled={!model}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!provider || !model || !apiKey || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditAiKeyDialog({
  config,
  onOpenChange,
  onSaved,
}: {
  config: AiProviderConfig | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [lastConfigId, setLastConfigId] = useState<number | null>(null)

  const { data: modelsByProvider } = useQuery({
    queryKey: ['ai-provider-models'],
    queryFn: async () => (await api.get<Record<AiProvider, string[]>>('/api/ai-configs/models')).data,
    enabled: !!config,
  })

  // Re-seed the form whenever a different config is opened for editing.
  if (config && config.id !== lastConfigId) {
    setLastConfigId(config.id)
    setModel(config.model)
    setApiKey('')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('No AI key selected')
      const body: { model?: string; apiKey?: string } = {}
      if (model !== config.model) body.model = model
      if (apiKey) body.apiKey = apiKey
      return (await api.patch(`/api/ai-configs/${config.id}`, body)).data
    },
    onSuccess: () => {
      toast.success(t('superAdminSettings.aiKeys.toast.updated'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('superAdminSettings.aiKeys.toast.updateFailed'))),
  })

  const models = config ? modelsByProvider?.[config.provider] ?? [] : []
  const hasChanges = !!config && (model !== config.model || !!apiKey)

  return (
    <Dialog open={!!config} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('superAdminSettings.aiKeys.editDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('superAdminSettings.aiKeys.editDialogDesc', { provider: config ? PROVIDER_LABELS[config.provider] : '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('superAdminSettings.aiKeys.model')}</Label>
            <Select value={model} onValueChange={(v) => setModel(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('superAdminSettings.aiKeys.selectModel')} />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('superAdminSettings.aiKeys.apiKey')}</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('superAdminSettings.aiKeys.leaveBlank', { last4: config?.apiKeyLastFour ?? '' })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!hasChanges || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('superAdminSettings.aiKeys.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TenantEmailServiceSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<TenantEmailRow[]>('/api/tenants')).data,
    enabled: expanded,
  })

  const filteredTenants = tenants.filter((tenant) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return tenant.name.toLowerCase().includes(query)
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) =>
      (await api.patch(`/api/tenants/${id}/email-service`, { enabled })).data,
    onSuccess: (_data, variables) => {
      toast.success(variables.enabled ? t('superAdminSettings.emailService.toast.enabled') : t('superAdminSettings.emailService.toast.disabled'))
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => toast.error(apiError(err, t('superAdminSettings.emailService.toast.updateFailed'))),
  })

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left group"
      >
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" /> {t('superAdminSettings.emailService.title')}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {t('superAdminSettings.emailService.subtitle')}
          </p>
        </div>
        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border group-hover:bg-muted/50 transition-colors">
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('superAdminSettings.emailService.searchPlaceholder')}
          />
          <SectionCard>
            {filteredTenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
                    {tenant.name.slice(0, 1).toUpperCase()}
                  </div>
                  <p className="font-medium truncate">{tenant.name}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={tenant.emailServiceEnabled ? 'default' : 'secondary'}>
                    {tenant.emailServiceEnabled ? t('superAdminSettings.emailService.enabled') : t('superAdminSettings.emailService.disabled')}
                  </Badge>
                  <Switch
                    checked={tenant.emailServiceEnabled}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(checked: boolean) =>
                      toggleMutation.mutate({ id: tenant.id, enabled: checked })
                    }
                  />
                </div>
              </div>
            ))}
            {!isLoading && tenants.length === 0 && <EmptyRow icon={Mail} text={t('superAdminSettings.emailService.noneYet')} />}
            {!isLoading && tenants.length > 0 && filteredTenants.length === 0 && (
              <EmptyRow icon={Search} text={t('superAdminSettings.emailService.noResults')} />
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}

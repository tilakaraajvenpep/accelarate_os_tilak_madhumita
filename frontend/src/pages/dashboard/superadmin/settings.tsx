import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, Mail, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Bot, Sparkles, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { PROVIDER_LABELS } from '@/lib/ai-provider'
import type { AiProvider, AiProviderConfig } from '@/types/ai-provider'
import type { Tenant } from '@/types/billing'

const PROVIDERS: { value: AiProvider; label: string; icon: typeof Bot; iconBg: string; iconColor: string }[] = [
  { value: 'openai', label: PROVIDER_LABELS.openai, icon: Bot, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
  { value: 'anthropic', label: PROVIDER_LABELS.anthropic, icon: Sparkles, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-600' },
]

const MODELS_BY_PROVIDER: Record<AiProvider, string[]> = {
  openai: ['gpt-5.1', 'gpt-5.1-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
  anthropic: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-fable-5', 'claude-haiku-4-5-20251001'],
}

function providerMeta(provider: AiProvider) {
  return PROVIDERS.find((p) => p.value === provider)!
}

export default function SettingsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-level configuration.</p>
      </div>

      <AiProviderKeysSection />
      <TenantEmailServiceSection />
    </div>
  )
}

function AiProviderKeysSection() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AiProviderConfig | null>(null)
  const [deleting, setDeleting] = useState<AiProviderConfig | null>(null)

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['ai-provider-configs'],
    queryFn: async () => (await api.get<AiProviderConfig[]>('/api/ai-provider-configs')).data,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ai-provider-configs'] })
  }

  const toggleEnabledMutation = useMutation({
    mutationFn: async (params: { id: number; enabled: boolean }) =>
      (await api.patch(`/api/ai-provider-configs/${params.id}/enabled`, { enabled: params.enabled })).data,
    onSuccess: invalidate,
    onError: (err) => toast.error(apiError(err, 'Failed to update key')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/ai-provider-configs/${id}`)).data,
    onSuccess: () => {
      toast.success('AI key deleted')
      invalidate()
      setDeleting(null)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to delete AI key')),
  })

  const filtered = configs.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return providerMeta(c.provider).label.toLowerCase().includes(q) || c.model.toLowerCase().includes(q)
  })

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">AI Provider Keys</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Configure API keys for AI models used across the platform.</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add AI key
        </Button>
      </div>

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 border-neutral-400 dark:border-neutral-600"
            placeholder="Search by provider or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          {filtered.map((config) => {
            const meta = providerMeta(config.provider)
            return (
              <div key={config.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', meta.iconBg)}>
                    <meta.icon className={cn('h-4 w-4', meta.iconColor)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{config.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={config.enabled ? 'default' : 'secondary'}>{config.enabled ? 'Active' : 'Inactive'}</Badge>
                  <Switch
                    checked={config.enabled}
                    disabled={toggleEnabledMutation.isPending}
                    onCheckedChange={(checked: boolean) => toggleEnabledMutation.mutate({ id: config.id, enabled: checked })}
                  />
                  <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => setEditing(config)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => setDeleting(config)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            )
          })}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">
              {configs.length === 0 ? 'No AI keys configured yet.' : 'No keys match your search.'}
            </p>
          )}
        </div>
      </div>

      <AiKeyFormDialog open={createOpen} onOpenChange={setCreateOpen} config={null} onSaved={invalidate} />
      <AiKeyFormDialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)} config={editing} onSaved={invalidate} />
      <DeleteAiKeyDialog
        config={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  )
}

function AiKeyFormDialog({
  open,
  onOpenChange,
  config,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: AiProviderConfig | null
  onSaved: () => void
}) {
  const isEdit = !!config
  const [provider, setProvider] = useState<AiProvider | null>(config?.provider ?? null)
  const [model, setModel] = useState(config?.model ?? '')
  const [apiKey, setApiKey] = useState('')
  const [lastConfigId, setLastConfigId] = useState<number | null | undefined>(undefined)

  if (open && config?.id !== lastConfigId) {
    setLastConfigId(config?.id ?? null)
    setProvider(config?.provider ?? null)
    setModel(config?.model ?? '')
    setApiKey('')
  }

  function handleOpenChange(next: boolean) {
    if (next && !config) {
      setProvider(null)
      setModel('')
      setApiKey('')
    }
    onOpenChange(next)
  }

  function handleProviderSelect(p: AiProvider) {
    if (isEdit) return
    setProvider(p)
    setModel('')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return (
          await api.patch(`/api/ai-provider-configs/${config!.id}`, {
            model,
            ...(apiKey ? { apiKey } : {}),
          })
        ).data
      }
      return (await api.post('/api/ai-provider-configs', { provider, model, apiKey })).data
    },
    onSuccess: () => {
      toast.success(isEdit ? 'AI key updated' : 'AI key created')
      onSaved()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, isEdit ? 'Failed to update AI key' : 'Failed to create AI key')),
  })

  const models = provider ? MODELS_BY_PROVIDER[provider] : []
  const canSubmit = isEdit ? !!model && (!!apiKey || true) : !!provider && !!model && !!apiKey

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit AI key' : 'Add AI key'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the model or replace the API key.' : 'Select a provider and model, then provide the API key.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                disabled={isEdit}
                onClick={() => handleProviderSelect(p.value)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
                  provider === p.value ? 'border-primary bg-primary/5' : 'hover:bg-muted',
                  isEdit && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', p.iconBg)}>
                  <p.icon className={cn('h-3.5 w-3.5', p.iconColor)} />
                </div>
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={model} onValueChange={(v) => setModel(v ?? '')} disabled={!provider}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={provider ? 'Select a model' : 'Select a provider first'} />
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
            <Label>API key</Label>
            <Input
              type="password"
              placeholder={isEdit ? 'Leave blank to keep the current key' : provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAiKeyDialog({
  config,
  onOpenChange,
  onConfirm,
  pending,
}: {
  config: AiProviderConfig | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={!!config} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete AI key</DialogTitle>
          <DialogDescription>
            {config && `Permanently remove the ${providerMeta(config.provider).label} (${config.model}) key? This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TenantEmailServiceSection() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [search, setSearch] = useState('')

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  const toggleMutation = useMutation({
    mutationFn: async (params: { id: number; enabled: boolean }) =>
      (await api.patch(`/api/tenants/${params.id}/email-service`, { enabled: params.enabled })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    onError: (err) => toast.error(apiError(err, 'Failed to update tenant')),
  })

  const filtered = tenants.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-6 py-4 border-b flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Tenant Email Service</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Show tenants and enable or disable their email service individually.</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 border-neutral-400 dark:border-neutral-600"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {filtered.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    {tenant.name[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm font-medium">{tenant.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={tenant.emailServiceEnabled ? 'default' : 'secondary'}>
                    {tenant.emailServiceEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Switch
                    checked={tenant.emailServiceEnabled}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(checked: boolean) => toggleMutation.mutate({ id: tenant.id, enabled: checked })}
                  />
                </div>
              </div>
            ))}
            {!isLoading && filtered.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-6">
                {tenants.length === 0 ? 'No tenants yet.' : 'No tenants match your search.'}
              </p>
            )}
          </div>
        </div>
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

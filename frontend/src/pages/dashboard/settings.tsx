import { useEffect, useState, type ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BellRing, Users, Image as ImageIcon, Palette, X } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { THEME_GRADIENT_PRESETS, gradientCss } from '@/lib/theme-color'
import { ImageCropDialog } from '@/components/image-crop-dialog'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NotificationSettings {
  notificationsEnabled: boolean
}

interface MentorInterest {
  interestedInMentoring: boolean
}

interface MentorProfile {
  specialization: string | null
}

interface TenantLogo {
  logoUrl: string | null
}

interface TenantBrandColor {
  brandColor: string | null
}

interface TenantBackgroundColor {
  backgroundColor: string | null
}

const DEFAULT_GRADIENT_FROM = THEME_GRADIENT_PRESETS[0].from
const DEFAULT_GRADIENT_TO = THEME_GRADIENT_PRESETS[0].to
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

const MAX_LOGO_FILE_BYTES = 1_000_000

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

function AdminSettings() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const { updateUser } = useAuth()

  const { data: notif, isLoading: notifLoading } = useQuery({
    queryKey: ['tenant-notification-settings'],
    queryFn: async () => (await api.get<NotificationSettings>('/api/tenants/me/notification-settings')).data,
  })

  const notifMutation = useMutation({
    mutationFn: async (enabled: boolean) => (await api.patch<NotificationSettings>('/api/tenants/me/notification-settings', { enabled })).data,
    onSuccess: (updated) => {
      toast.success(updated.notificationsEnabled ? t('notifications.enabledToast') : t('notifications.disabledToast'))
      queryClient.setQueryData(['tenant-notification-settings'], updated)
    },
    onError: (err) => toast.error(apiError(err, t('notifications.toggleFailed'))),
  })

  const { data: interest, isLoading: interestLoading } = useQuery({
    queryKey: ['mentor-interest'],
    queryFn: async () => (await api.get<MentorInterest>('/api/tenants/me/mentor-interest')).data,
  })

  const interestMutation = useMutation({
    mutationFn: async (interested: boolean) => (await api.patch<MentorInterest>('/api/tenants/me/mentor-interest', { interested })).data,
    onSuccess: (updated) => {
      toast.success(updated.interestedInMentoring ? t('mentorInterest.enabledToast') : t('mentorInterest.disabledToast'))
      queryClient.setQueryData(['mentor-interest'], updated)
      updateUser({ interestedInMentoring: updated.interestedInMentoring })
    },
    onError: (err) => toast.error(apiError(err, t('mentorInterest.toggleFailed'))),
  })

  return (
    <>
      <TenantLogoSettings />
      <TenantThemeSettings />

      {/* Notifications setting */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
          <BellRing className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('notifications.title')}</h2>
        </div>
        <div className="flex items-center justify-between gap-6 p-5">
          <p className="text-sm text-muted-foreground font-medium max-w-md">{t('notifications.description')}</p>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold ${
              notif?.notificationsEnabled ? 'text-foreground font-bold' : 'text-muted-foreground'
            }`}>
              {notif?.notificationsEnabled ? t('common:enabled') : t('common:disabled')}
            </span>
            <Switch
              checked={notif?.notificationsEnabled ?? false}
              disabled={notifLoading || notifMutation.isPending}
              onCheckedChange={(checked: boolean) => notifMutation.mutate(checked)}
            />
          </div>
        </div>
      </div>

      {/* Mentor interest setting */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('mentorInterest.title')}</h2>
        </div>
        <div className="flex items-center justify-between gap-6 p-5">
          <p className="text-sm text-muted-foreground font-medium max-w-md">{t('mentorInterest.description')}</p>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold ${
              interest?.interestedInMentoring ? 'text-foreground font-bold' : 'text-muted-foreground'
            }`}>
              {interest?.interestedInMentoring ? t('common:enabled') : t('common:disabled')}
            </span>
            <Switch
              checked={interest?.interestedInMentoring ?? false}
              disabled={interestLoading || interestMutation.isPending}
              onCheckedChange={(checked: boolean) => interestMutation.mutate(checked)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function TenantLogoSettings() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  const { data: logo, isLoading } = useQuery({
    queryKey: ['tenant-logo'],
    queryFn: async () => (await api.get<TenantLogo>('/api/tenants/me/logo')).data,
  })

  const mutation = useMutation({
    mutationFn: async (logoUrl: string | null) => (await api.patch<TenantLogo>('/api/tenants/me/logo', { logoUrl })).data,
    onSuccess: (updated) => {
      toast.success(updated.logoUrl ? t('logo.savedToast') : t('logo.removedToast'))
      queryClient.setQueryData(['tenant-logo'], updated)
      queryClient.invalidateQueries({ queryKey: ['tenant-by-slug'] })
      setPreview(null)
    },
    onError: (err) => toast.error(apiError(err, t('logo.saveFailed'))),
  })

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('logo.invalidFileType'))
      return
    }
    if (file.size > MAX_LOGO_FILE_BYTES) {
      toast.error(t('logo.tooLarge'))
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    setPreview(dataUrl)
  }

  const displayUrl = preview ?? logo?.logoUrl ?? null

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('logo.title')}</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground font-medium max-w-lg">{t('logo.description')}</p>
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 border border-border flex items-center justify-center overflow-hidden flex-shrink-0 rounded-lg bg-accent">
            {!isLoading && displayUrl ? (
              <img src={displayUrl} alt={t('logo.title')} className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-3 flex-1">
            <Input type="file" accept="image/*" onChange={handleFileChange} className="max-w-xs h-9 text-xs" />
            <p className="text-xs text-muted-foreground font-medium">{t('logo.sizeHint')}</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                disabled={!preview || mutation.isPending}
                onClick={() => preview && mutation.mutate(preview)}
                className="h-9 px-4 text-xs font-semibold"
              >
                {t('common:saveChanges')}
              </Button>
              {preview && (
                <Button size="sm" variant="outline" onClick={() => setCropOpen(true)} className="h-9 px-4 text-xs font-semibold">
                  {t('logo.cropButton')}
                </Button>
              )}
              {preview && (
                <Button size="sm" variant="outline" onClick={() => setPreview(null)} className="h-9 px-4 text-xs font-semibold">
                  {t('common:cancel')}
                </Button>
              )}
              {!preview && logo?.logoUrl && (
                <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(null)} className="h-9 px-4 text-xs font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive">
                  <X className="h-3.5 w-3.5 mr-1" /> {t('logo.remove')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <ImageCropDialog
        imageSrc={preview}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={(cropped) => setPreview(cropped)}
        title={t('logo.cropButton')}
      />
    </div>
  )
}

function TenantThemeSettings() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const [fromDraft, setFromDraft] = useState<string | null>(null)
  const [toDraft, setToDraft] = useState<string | null>(null)

  const { data: from, isLoading: fromLoading } = useQuery({
    queryKey: ['tenant-brand-color'],
    queryFn: async () => (await api.get<TenantBrandColor>('/api/tenants/me/brand-color')).data,
  })
  const { data: to, isLoading: toLoading } = useQuery({
    queryKey: ['tenant-background-color'],
    queryFn: async () => (await api.get<TenantBackgroundColor>('/api/tenants/me/background-color')).data,
  })
  const loading = fromLoading || toLoading

  const saveMutation = useMutation({
    mutationFn: async (input: { brandColor: string | null; backgroundColor: string | null }) => {
      const [fromResult, toResult] = await Promise.all([
        api.patch<TenantBrandColor>('/api/tenants/me/brand-color', { brandColor: input.brandColor }),
        api.patch<TenantBackgroundColor>('/api/tenants/me/background-color', { backgroundColor: input.backgroundColor }),
      ])
      return { from: fromResult.data, to: toResult.data }
    },
    onSuccess: ({ from: updatedFrom, to: updatedTo }, variables) => {
      const wasReset = variables.brandColor === null && variables.backgroundColor === null
      toast.success(wasReset ? t('theme.resetToast') : t('theme.savedToast'))
      queryClient.setQueryData(['tenant-brand-color'], updatedFrom)
      queryClient.setQueryData(['tenant-background-color'], updatedTo)
      queryClient.invalidateQueries({ queryKey: ['tenant-by-slug'] })
      setFromDraft(null)
      setToDraft(null)
    },
    onError: (err) => toast.error(apiError(err, t('theme.saveFailed'))),
  })

  const currentFrom = fromDraft ?? from?.brandColor ?? DEFAULT_GRADIENT_FROM
  const currentTo = toDraft ?? to?.backgroundColor ?? DEFAULT_GRADIENT_TO
  const hasChange = (fromDraft !== null && fromDraft !== (from?.brandColor ?? '')) || (toDraft !== null && toDraft !== (to?.backgroundColor ?? ''))
  const isValid = HEX_COLOR_PATTERN.test(currentFrom) && HEX_COLOR_PATTERN.test(currentTo)
  const hasCustomTheme = !!from?.brandColor || !!to?.backgroundColor

  function selectPreset(preset: { from: string; to: string }) {
    setFromDraft(preset.from)
    setToDraft(preset.to)
  }

  function handleSave() {
    saveMutation.mutate({ brandColor: currentFrom, backgroundColor: currentTo })
  }

  function handleReset() {
    saveMutation.mutate({ brandColor: null, backgroundColor: null })
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('theme.title')}</h2>
      </div>
      <div className="p-5 space-y-5">
        <p className="text-sm text-muted-foreground font-medium max-w-lg">{t('theme.description')}</p>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('theme.presetLabel')}</Label>
          <div className="flex flex-wrap gap-2">
            {THEME_GRADIENT_PRESETS.map((preset) => {
              const active = currentFrom.toLowerCase() === preset.from.toLowerCase() && currentTo.toLowerCase() === preset.to.toLowerCase()
              return (
                <button
                  key={preset.name}
                  type="button"
                  title={preset.name}
                  disabled={loading}
                  onClick={() => selectPreset(preset)}
                  className={cn(
                    'h-9 w-9 rounded-lg border cursor-pointer shadow-sm transition-all hover:scale-105',
                    active ? 'border-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-card' : 'border-border',
                  )}
                  style={{ backgroundImage: gradientCss(preset.from, preset.to) }}
                />
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">{t('theme.fromLabel')}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_COLOR_PATTERN.test(currentFrom) ? currentFrom : DEFAULT_GRADIENT_FROM}
                disabled={loading}
                onChange={(e) => setFromDraft(e.target.value)}
                className="h-9 w-10 rounded border border-input cursor-pointer bg-transparent"
              />
              <Input value={currentFrom} placeholder={DEFAULT_GRADIENT_FROM} disabled={loading} onChange={(e) => setFromDraft(e.target.value)} className="h-9 text-sm font-mono max-w-[120px]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">{t('theme.toLabel')}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_COLOR_PATTERN.test(currentTo) ? currentTo : DEFAULT_GRADIENT_TO}
                disabled={loading}
                onChange={(e) => setToDraft(e.target.value)}
                className="h-9 w-10 rounded border border-input cursor-pointer bg-transparent"
              />
              <Input value={currentTo} placeholder={DEFAULT_GRADIENT_TO} disabled={loading} onChange={(e) => setToDraft(e.target.value)} className="h-9 text-sm font-mono max-w-[120px]" />
            </div>
          </div>
        </div>

        <div className="h-8 rounded-lg border border-border" style={{ backgroundImage: isValid ? gradientCss(currentFrom, currentTo) : undefined }} />

        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 px-4 text-xs font-semibold" disabled={!hasChange || !isValid || saveMutation.isPending} onClick={handleSave}>
            {t('common:saveChanges')}
          </Button>
          {hasCustomTheme && (
            <Button size="sm" variant="outline" className="h-9 px-4 text-xs font-semibold" disabled={saveMutation.isPending} onClick={handleReset}>
              <X className="h-3.5 w-3.5 mr-1" /> {t('theme.reset')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function MentorSettings() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const [specialization, setSpecialization] = useState('')

  const { data: profile } = useQuery({
    queryKey: ['mentor-profile'],
    queryFn: async () => (await api.get<MentorProfile>('/api/tenants/me/mentor-profile')).data,
  })

  useEffect(() => {
    if (profile?.specialization) setSpecialization(profile.specialization)
  }, [profile])

  const mutation = useMutation({
    mutationFn: async () => (await api.patch<MentorProfile>('/api/tenants/me/mentor-profile', { specialization })).data,
    onSuccess: (updated) => {
      toast.success(t('mentorProfile.savedToast'))
      queryClient.setQueryData(['mentor-profile'], updated)
    },
    onError: (err) => toast.error(apiError(err, t('mentorProfile.saveFailed'))),
  })

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('mentorProfile.title')}</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground font-medium">{t('mentorProfile.description')}</p>
        <div className="space-y-1.5 max-w-md">
          <Label className="text-xs font-semibold text-muted-foreground">{t('mentorProfile.specializationLabel')}</Label>
          <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="h-9 text-sm" />
        </div>
        <Button className="h-9 px-4 text-xs font-semibold" disabled={!specialization.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          {t('common:saveChanges')}
        </Button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { t } = useTranslation('settings')

  if (user?.role !== 'admin' && user?.role !== 'mentor') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t('notAvailable')}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('page.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('page.subtitle')}</p>
      </div>

      {user.role === 'admin' ? (
        <>
          <AdminSettings />
          {user.interestedInMentoring && <MentorSettings />}
        </>
      ) : (
        <MentorSettings />
      )}
    </div>
  )
}

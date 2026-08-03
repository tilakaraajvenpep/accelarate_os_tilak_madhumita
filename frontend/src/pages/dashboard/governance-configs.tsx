import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Cohort } from '@/types/cohort'
import type { GovernanceConfig, PillarDefinition } from '@/types/governance'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

export default function GovernanceConfigsPage() {
  const { t } = useTranslation('governance')
  const queryClient = useQueryClient()
  const [cohortId, setCohortId] = useState<string>('none')
  const [purpose, setPurpose] = useState('')
  const [selectedPillars, setSelectedPillars] = useState<number[]>([])

  const { data: cohorts = [] } = useQuery({
    queryKey: ['cohorts-list'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
  })

  const { data: pillarDefinitions = [] } = useQuery({
    queryKey: ['pillar-definitions'],
    queryFn: async () => (await api.get<PillarDefinition[]>('/api/tenants/me/pillar-definitions')).data,
  })

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['governance-configs'],
    queryFn: async () => (await api.get<GovernanceConfig[]>('/api/governance/configs')).data,
  })

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<GovernanceConfig>('/api/governance/configs', {
          cohortId: cohortId === 'none' ? undefined : Number(cohortId),
          applicablePillars: selectedPillars,
          purpose: purpose.trim() || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance-configs'] })
      toast.success(t('configs.toast.created'))
      setPurpose('')
      setSelectedPillars([])
      setCohortId('none')
    },
    onError: (err) => toast.error(apiError(err, t('configs.toast.createFailed'))),
  })

  function togglePillar(pillarNumber: number) {
    setSelectedPillars((prev) => (prev.includes(pillarNumber) ? prev.filter((p) => p !== pillarNumber) : [...prev, pillarNumber]))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('configs.page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('configs.page.subtitle')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('configs.form.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('configs.form.cohortLabel')}</label>
            <Select value={cohortId} onValueChange={(v) => v !== null && setCohortId(v)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder={t('configs.form.allCohortsOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('configs.form.allCohortsOption')}</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('configs.form.purposeLabel')}</label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('configs.form.purposePlaceholder')} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('configs.form.pillarsLabel')}</label>
            {pillarDefinitions.length === 0 && <p className="text-sm text-muted-foreground">{t('configs.form.noPillars')}</p>}
            <div className="space-y-2">
              {pillarDefinitions.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedPillars.includes(p.pillarNumber)} onCheckedChange={() => togglePillar(p.pillarNumber)} />
                  {p.title
                    ? t('configs.form.pillarLabelWithTitle', { number: p.pillarNumber, title: p.title })
                    : t('configs.form.pillarLabel', { number: p.pillarNumber })}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || selectedPillars.length === 0}>
            {t('configs.form.createButton')}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('configs.list.title')}</h2>
        {isLoading && <p className="text-sm text-muted-foreground">{t('common:loading')}</p>}
        {!isLoading && configs.length === 0 && (
          <div className="surface-card text-center py-10">
            <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('configs.list.empty')}</p>
          </div>
        )}
        {configs.map((config) => (
          <Card key={config.id}>
            <CardContent className="p-4 space-y-1">
              <p className="font-medium text-sm">{config.purpose || t('configs.list.defaultPurpose')}</p>
              <p className="text-xs text-muted-foreground">
                {t('configs.list.summary', {
                  cohort: cohorts.find((c) => c.id === config.cohortId)?.name || t('configs.form.allCohortsOption'),
                  pillars: config.applicablePillars.join(', ') || t('configs.list.noPillarsValue'),
                })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

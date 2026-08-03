import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { GovernanceConfig, GovernanceSession } from '@/types/governance'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

function statusVariant(status: GovernanceSession['status']) {
  if (status === 'reviewed') return 'success' as const
  if (status === 'submitted') return 'warning' as const
  return 'outline' as const
}

export default function GovernancePage() {
  const { t } = useTranslation('founderGovernance')
  const queryClient = useQueryClient()
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({})

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['governance-configs'],
    queryFn: async () => (await api.get<GovernanceConfig[]>('/api/governance/configs')).data,
  })

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['governance-sessions'],
    queryFn: async () => (await api.get<GovernanceSession[]>('/api/governance/sessions')).data,
  })

  const startMutation = useMutation({
    mutationFn: async (configId: number) => (await api.post<GovernanceSession>('/api/governance/sessions', { configId })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance-sessions'] })
      toast.success(t('toast.started'))
    },
    onError: (err) => toast.error(apiError(err, t('toast.startFailed'))),
  })

  const submitMutation = useMutation({
    mutationFn: async ({ sessionId, founderNotes }: { sessionId: number; founderNotes: string }) =>
      (await api.post<GovernanceSession>(`/api/governance/sessions/${sessionId}/submit`, { founderNotes })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance-sessions'] })
      toast.success(t('toast.submitted'))
    },
    onError: (err) => toast.error(apiError(err, t('toast.submitFailed'))),
  })

  async function handleDownload(sessionId: number) {
    try {
      const res = await api.get(`/api/governance/sessions/${sessionId}/document`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `governance-report-${sessionId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(apiError(err, t('toast.reportNotReady')))
    }
  }

  const sessionByConfig = new Map(sessions.map((s) => [s.configId, s]))
  const isLoading = configsLoading || sessionsLoading

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t('page.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('page.subtitle')}
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t('common:loading')}</p>}

      {!isLoading && configs.length === 0 && (
        <Card className="border-dashed p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </Card>
      )}

      {configs.map((config) => {
        const session = sessionByConfig.get(config.id)
        const draft = notesDraft[config.id] ?? session?.founderNotes ?? ''
        const canEdit = !session || session.status === 'draft'

        return (
          <Card key={config.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">{config.purpose || t('card.defaultTitle')}</CardTitle>
              {session && <Badge variant={statusVariant(session.status)}>{t(`status.${session.status}`)}</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              {!session && (
                <Button onClick={() => startMutation.mutate(config.id)} disabled={startMutation.isPending}>
                  {t('actions.start')}
                </Button>
              )}

              {session && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t('form.notesLabel')}</label>
                    <Textarea
                      value={draft}
                      disabled={!canEdit}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [config.id]: e.target.value }))}
                      placeholder={t('form.notesPlaceholder')}
                      className="min-h-24"
                    />
                  </div>

                  {canEdit && (
                    <Button
                      onClick={() => submitMutation.mutate({ sessionId: session.id, founderNotes: draft })}
                      disabled={submitMutation.isPending}
                    >
                      {t('actions.submit')}
                    </Button>
                  )}

                  {session.status === 'reviewed' && (
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                      <p><span className="font-medium">{t('review.outcomeLabel')}</span> {session.outcome}</p>
                      <p><span className="font-medium">{t('review.feedbackLabel')}</span> {session.feedback}</p>
                    </div>
                  )}

                  {session.documentGeneratedAt && (
                    <Button variant="outline" onClick={() => handleDownload(session.id)}>
                      <Download className="h-4 w-4" /> {t('actions.downloadReport')}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

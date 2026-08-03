import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { CompanyEntry } from '@/types/company'
import type { GovernanceConfig, GovernanceSession } from '@/types/governance'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

function statusVariant(status: GovernanceSession['status']) {
  if (status === 'reviewed') return 'success' as const
  if (status === 'submitted') return 'warning' as const
  return 'outline' as const
}

export default function GovernanceReviewPage() {
  const { t } = useTranslation('governance')
  const queryClient = useQueryClient()
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { feedback: string; outcome: string }>>({})

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['governance-sessions-all'],
    queryFn: async () => (await api.get<GovernanceSession[]>('/api/governance/sessions')).data,
  })

  const { data: configs = [] } = useQuery({
    queryKey: ['governance-configs'],
    queryFn: async () => (await api.get<GovernanceConfig[]>('/api/governance/configs')).data,
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['company-entries-all'],
    queryFn: async () => (await api.get<CompanyEntry[]>('/api/tenants/me/companies')).data,
  })

  const companyName = (companyId: number) => {
    const entry = companies.find((c) => Number(c.id.replace('company-', '')) === companyId)
    return entry?.name || t('review.session.companyFallback', { id: companyId })
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['governance-sessions-all'] })

  const reviewMutation = useMutation({
    mutationFn: async ({ sessionId, feedback, outcome }: { sessionId: number; feedback: string; outcome: string }) =>
      (await api.post<GovernanceSession>(`/api/governance/sessions/${sessionId}/review`, { feedback, outcome })).data,
    onSuccess: () => {
      invalidate()
      toast.success(t('review.toast.reviewSubmitted'))
    },
    onError: (err) => toast.error(apiError(err, t('review.toast.reviewFailed'))),
  })

  const reopenMutation = useMutation({
    mutationFn: async (sessionId: number) => (await api.post<GovernanceSession>(`/api/governance/sessions/${sessionId}/reopen`, {})).data,
    onSuccess: () => {
      invalidate()
      toast.success(t('review.toast.reopened'))
    },
    onError: (err) => toast.error(apiError(err, t('review.toast.reopenFailed'))),
  })

  const generateMutation = useMutation({
    mutationFn: async (sessionId: number) => (await api.post(`/api/governance/sessions/${sessionId}/generate-document`)).data,
    onSuccess: () => {
      invalidate()
      toast.success(t('review.toast.generated'))
    },
    onError: (err) => toast.error(apiError(err, t('review.toast.generateFailed'))),
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
      toast.error(apiError(err, t('review.toast.downloadFailed')))
    }
  }

  const reviewable = sessions.filter((s) => s.status !== 'draft')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t('review.page.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('review.page.subtitle')}
        </p>
      </div>

      {sessionsLoading && <p className="text-sm text-muted-foreground">{t('common:loading')}</p>}
      {!sessionsLoading && reviewable.length === 0 && (
        <Card className="border-dashed p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('review.empty.title')}</p>
        </Card>
      )}

      {reviewable.map((session) => {
        const config = configs.find((c) => c.id === session.configId)
        const draft = reviewDrafts[session.id] ?? { feedback: session.feedback ?? '', outcome: session.outcome ?? '' }

        return (
          <Card key={session.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {companyName(session.companyId)} · {config?.purpose || t('review.session.defaultPurpose')}
              </CardTitle>
              <Badge variant={statusVariant(session.status)}>{t(`review.status.${session.status}`)}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {session.founderNotes && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  <span className="font-medium text-foreground">{t('review.session.founderNotesLabel')} </span>
                  {session.founderNotes}
                </p>
              )}

              {session.status === 'submitted' && (
                <div className="space-y-3">
                  <Input
                    placeholder={t('review.session.outcomePlaceholder')}
                    value={draft.outcome}
                    onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [session.id]: { ...draft, outcome: e.target.value } }))}
                  />
                  <Input
                    placeholder={t('review.session.feedbackPlaceholder')}
                    value={draft.feedback}
                    onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [session.id]: { ...draft, feedback: e.target.value } }))}
                  />
                  <Button
                    onClick={() => reviewMutation.mutate({ sessionId: session.id, ...draft })}
                    disabled={reviewMutation.isPending || !draft.outcome.trim() || !draft.feedback.trim()}
                  >
                    {t('review.session.submitReviewButton')}
                  </Button>
                </div>
              )}

              {session.status === 'reviewed' && (
                <div className="flex flex-wrap items-center gap-2">
                  {!session.documentGeneratedAt && (
                    <Button onClick={() => generateMutation.mutate(session.id)} disabled={generateMutation.isPending}>
                      <Sparkles className="h-4 w-4" /> {t('review.session.generateReportButton')}
                    </Button>
                  )}
                  {session.documentGeneratedAt && (
                    <Button variant="outline" onClick={() => handleDownload(session.id)}>
                      <Download className="h-4 w-4" /> {t('review.session.downloadReportButton')}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => reopenMutation.mutate(session.id)} disabled={reopenMutation.isPending}>
                    <RotateCcw className="h-4 w-4" /> {t('review.session.reopenButton')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

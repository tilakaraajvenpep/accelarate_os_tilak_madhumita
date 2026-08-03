import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, GitBranch, Download, ShieldAlert, FileText } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DynamicForm } from '@/components/dynamic-form'
import type { FormResponseInstance } from '@/types/forms'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

const FOUNDER_RESTRICTED_SECTIONS = ['D', 'E']

export default function PillarDetailPage() {
  const { t } = useTranslation('founderPillars')
  const { pillarNumber } = useParams<{ pillarNumber: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeInstance, setActiveInstance] = useState<FormResponseInstance | null>(null)
  const [branchTarget, setBranchTarget] = useState<FormResponseInstance | null>(null)
  const [branchName, setBranchName] = useState('')

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['form-responses-resolve', pillarNumber],
    queryFn: async () =>
      (
        await api.get<FormResponseInstance[]>('/api/tenants/me/form-responses/resolve', {
          params: { type: 'pillar_diagnostic', contextId: pillarNumber },
        })
      ).data,
    enabled: !!pillarNumber,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ data, status }: { data: Record<string, unknown>; status: 'draft' | 'submitted' }) => {
      if (!activeInstance) return
      await api.post('/api/tenants/me/form-responses', {
        templateId: activeInstance.template.id,
        mappingId: activeInstance.mappingId,
        responseId: activeInstance.response?.id ?? null,
        responseJson: data,
        status,
      })
    },
    onSuccess: (_data, { status }) => {
      toast.success(status === 'submitted' ? t('detail.toast.responseSubmitted') : t('detail.toast.draftSaved'))
      setActiveInstance(null)
      queryClient.invalidateQueries({ queryKey: ['form-responses-resolve', pillarNumber] })
      queryClient.invalidateQueries({ queryKey: ['pillars'] })
    },
    onError: (err) => toast.error(apiError(err, t('detail.toast.saveFailed'))),
  })

  const branchMutation = useMutation({
    mutationFn: async () => {
      if (!branchTarget) return
      await api.post('/api/tenants/me/form-responses', {
        templateId: branchTarget.template.id,
        mappingId: branchTarget.mappingId,
        responseJson: { ...(branchTarget.response?.responseJson ?? {}), _entryName: branchName.trim() },
        status: 'draft',
      })
    },
    onSuccess: () => {
      toast.success(t('detail.toast.entryCreated'))
      setBranchTarget(null)
      setBranchName('')
      queryClient.invalidateQueries({ queryKey: ['form-responses-resolve', pillarNumber] })
    },
    onError: (err) => toast.error(apiError(err, t('detail.toast.branchFailed'))),
  })

  async function handleExport(responseId: number, format: 'excel' | 'pdf') {
    try {
      const res = await api.get(`/api/tenants/me/form-responses/${responseId}/export/${format}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `form-export-${responseId}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(apiError(err, t('detail.toast.exportFailed')))
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, FormResponseInstance[]>()
    for (const inst of instances) {
      const list = map.get(inst.sectionId) ?? []
      list.push(inst)
      map.set(inst.sectionId, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [instances])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/pillars')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{t('detail.title', { number: pillarNumber })}</h1>
      </div>

      {!isLoading && instances.length === 0 && (
        <div className="surface-card p-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('detail.empty')}</p>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([sectionId, items]) => {
          const restricted = FOUNDER_RESTRICTED_SECTIONS.includes(sectionId)
          return (
            <div key={sectionId} className="surface-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-2">
                <h3 className="font-semibold text-sm">{sectionId ? t('detail.sectionLabel', { sectionId }) : t('detail.assessmentsLabel')}</h3>
                {restricted && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> {t('detail.mentorAdminOnlyBadge')}
                  </Badge>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('detail.table.assessment')}</TableHead>
                    <TableHead>{t('detail.table.status')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((inst, idx) => {
                    const entryName = (inst.response?.responseJson?._entryName as string) || inst.template.title
                    return (
                      <TableRow key={`${inst.mappingId}-${inst.response?.id ?? idx}`}>
                        <TableCell className="font-medium">{entryName}</TableCell>
                        <TableCell>
                          {!inst.hasResponse && <Badge variant="secondary">{t('detail.status.notStarted')}</Badge>}
                          {inst.hasResponse && inst.response?.status === 'draft' && <Badge variant="secondary">{t('detail.status.draft')}</Badge>}
                          {inst.hasResponse && inst.response?.status === 'submitted' && <Badge variant="success">{t('detail.status.submitted')}</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {inst.template.isMultipleEntry && inst.hasResponse && !restricted && (
                              <Button variant="ghost" size="icon-sm" title={t('detail.branchOutTooltip')} onClick={() => setBranchTarget(inst)}>
                                <GitBranch className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {inst.hasResponse && inst.response?.status === 'submitted' && (
                              <>
                                <Button variant="ghost" size="icon-sm" title={t('detail.exportExcelTooltip')} onClick={() => handleExport(inst.response!.id, 'excel')}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            <Button variant="outline" size="sm" disabled={restricted} onClick={() => setActiveInstance(inst)}>
                              {inst.hasResponse ? t('detail.openButton') : t('detail.startButton')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )
        })}
      </div>

      <Dialog open={!!activeInstance} onOpenChange={(open) => !open && setActiveInstance(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeInstance?.template.title}</DialogTitle>
            {activeInstance?.template.description && <DialogDescription>{activeInstance.template.description}</DialogDescription>}
          </DialogHeader>
          {activeInstance && (
            <DynamicForm
              schema={activeInstance.template.schema}
              initialData={activeInstance.response?.responseJson}
              category={activeInstance.template.category}
              requireConsent={activeInstance.template.requireConsent}
              consentTermsText={activeInstance.template.consentTermsText}
              onSubmit={async (data, status) => saveMutation.mutateAsync({ data, status })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!branchTarget} onOpenChange={(open) => !open && setBranchTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('detail.branchDialog.title', { title: branchTarget?.template.title })}</DialogTitle>
            <DialogDescription>{t('detail.branchDialog.description')}</DialogDescription>
          </DialogHeader>
          <Input placeholder={t('detail.branchDialog.namePlaceholder')} value={branchName} onChange={(e) => setBranchName(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBranchTarget(null)}>
              {t('common:cancel')}
            </Button>
            <Button disabled={!branchName.trim() || branchMutation.isPending} onClick={() => branchMutation.mutate()}>
              {t('common:create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileText, Upload, Download, Trash2, FolderOpen, Eye } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useViewAsCompany } from '@/context/view-as-context'
import { api } from '@/lib/api'
import { downloadFile } from '@/lib/utils'
import { DocumentPreview } from '@/components/document-preview'
import { useConfirm } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Cohort } from '@/types/cohort'

interface CohortDocumentEntry {
  id: number
  title: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedByUserId: number
  uploadedByName: string | null
  createdAt: string
}

const MAX_DOCUMENT_FILE_BYTES = 8_000_000

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function DocumentsPage() {
  const { t } = useTranslation('documents')
  const { user } = useAuth()
  const viewAs = useViewAsCompany()
  const queryClient = useQueryClient()
  // A "View as founder" preview always behaves like the founder branch below, regardless of the admin's real role.
  const isAdmin = !viewAs && user?.role === 'admin'
  const isMentor = !viewAs && user?.role === 'mentor'
  const isFounder = !!viewAs || user?.role === 'founder'
  const canUpload = isAdmin || isMentor

  const [selectedCohortId, setSelectedCohortId] = useState<string>('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [previewingId, setPreviewingId] = useState<number | null>(null)
  const confirm = useConfirm()

  const { data: adminCohorts = [] } = useQuery({
    queryKey: ['cohorts-list'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
    enabled: isAdmin,
  })

  const { data: mentorCohorts = [] } = useQuery({
    queryKey: ['mentor-all-cohorts'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/mentor/cohorts')).data,
    enabled: isMentor,
  })

  const cohorts = isAdmin ? adminCohorts : mentorCohorts

  const { data: cohortDocs = [], isLoading: cohortDocsLoading } = useQuery({
    queryKey: ['cohort-documents', selectedCohortId],
    queryFn: async () => (await api.get<CohortDocumentEntry[]>(`/api/tenants/me/cohorts/${selectedCohortId}/documents`)).data,
    enabled: canUpload && !!selectedCohortId,
  })

  const { data: founderDocs = [], isLoading: founderDocsLoading } = useQuery({
    queryKey: ['founder-documents', viewAs?.companyId],
    queryFn: async () =>
      (
        await api.get<CohortDocumentEntry[]>(
          viewAs ? `/api/tenants/me/companies/${viewAs.companyId}/view-as/documents` : '/api/tenants/me/founder/documents',
        )
      ).data,
    enabled: isFounder,
  })

  const documents = isFounder ? founderDocs : cohortDocs
  const documentsLoading = isFounder ? founderDocsLoading : cohortDocsLoading

  function documentUrl(docId: number) {
    return viewAs
      ? `/api/tenants/me/companies/${viewAs.companyId}/view-as/documents/${docId}`
      : isFounder
        ? `/api/tenants/me/founder/documents/${docId}`
        : `/api/tenants/me/cohorts/${selectedCohortId}/documents/${docId}`
  }

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => (await api.delete(`/api/tenants/me/cohorts/${selectedCohortId}/documents/${docId}`)).data,
    onSuccess: () => {
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['cohort-documents', selectedCohortId] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.deleteFailed'))),
  })

  async function handleDelete(doc: CohortDocumentEntry) {
    const ok = await confirm({
      title: t('deleteDialog.title'),
      description: t('deleteDialog.confirm', { title: doc.title }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (ok) {
      deleteMutation.mutate(doc.id)
    }
  }

  if (!isAdmin && !isMentor && !isFounder) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t('notAvailable')}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isFounder ? t('page.subtitleFounder') : t('page.subtitleAdmin')}
          </p>
        </div>
        {canUpload && selectedCohortId && (
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4" /> {t('page.uploadButton')}
          </Button>
        )}
      </div>

      {canUpload && (
        <div className="space-y-1.5 max-w-xs">
          <Label>{t('filters.cohortLabel')}</Label>
          <Select value={selectedCohortId} onValueChange={(v) => v && setSelectedCohortId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('filters.cohortPlaceholder')}>
                {(v: string) => cohorts.find((c) => String(c.id) === v)?.name ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={String(cohort.id)}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader className="border-b flex-row items-center gap-2 space-y-0">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">{t('list.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {canUpload && !selectedCohortId ? (
            <div className="text-center py-10">
              <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('list.selectCohortPrompt')}</p>
            </div>
          ) : documentsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-10">{t('common:loading')}</p>
          ) : documents.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div key={doc.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.fileName} · {formatFileSize(doc.fileSize)}
                        {doc.uploadedByName ? ` · ${t('list.uploadedBy', { name: doc.uploadedByName })}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('list.previewTooltip')}
                        onClick={() => setPreviewingId(previewingId === doc.id ? null : doc.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title={t('list.downloadTooltip')} onClick={() => downloadFile(documentUrl(doc.id), doc.fileName)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {canUpload && (isAdmin || doc.uploadedByUserId === user?.id) && (
                        <Button variant="ghost" size="icon-sm" title={t('list.deleteTooltip')} onClick={() => handleDelete(doc)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {previewingId === doc.id && (
                    <div className="px-4 pb-3">
                      <DocumentPreview fetchUrl={documentUrl(doc.id)} fileName={doc.fileName} open hideTrigger onOpenChange={() => {}} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        cohortId={selectedCohortId}
        onUploaded={() => queryClient.invalidateQueries({ queryKey: ['cohort-documents', selectedCohortId] })}
      />


    </div>
  )
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  cohortId,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohortId: string
  onUploaded: () => void
}) {
  const { t } = useTranslation('documents')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<{ fileName: string; fileType: string; fileData: string; fileSize: number } | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.size > MAX_DOCUMENT_FILE_BYTES) {
      toast.error(t('toast.fileTooLarge'))
      return
    }
    const fileData = await readFileAsDataUrl(picked)
    setFile({ fileName: picked.name, fileType: picked.type || 'application/octet-stream', fileData, fileSize: picked.size })
  }

  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/api/tenants/me/cohorts/${cohortId}/documents`, { title, ...file })).data,
    onSuccess: () => {
      toast.success(t('toast.uploaded'))
      onUploaded()
      onOpenChange(false)
      setTitle('')
      setFile(null)
    },
    onError: (err) => toast.error(apiError(err, t('toast.uploadFailed'))),
  })

  const formValid = title.trim().length > 0 && !!file

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('uploadDialog.title')}</DialogTitle>
          <DialogDescription>{t('uploadDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('uploadDialog.titleLabel')}</Label>
            <Input value={title} placeholder={t('uploadDialog.titlePlaceholder')} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label required>{t('uploadDialog.fileLabel')}</Label>
            <Input type="file" onChange={handleFileChange} />
            {file && <p className="text-xs text-muted-foreground">{file.fileName} · {formatFileSize(file.fileSize)}</p>}
            <p className="text-xs text-muted-foreground">{t('uploadDialog.fileSizeHint')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {t('uploadDialog.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

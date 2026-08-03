import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { X, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DynamicForm } from '@/components/dynamic-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormQuestion } from '@/types/forms'

interface FormWithSchema {
  id: number
  name: string
  schema: FormQuestion[]
  category: string
  requireConsent: boolean
  consentTermsText: string | null
}

interface DocumentFile {
  fileName: string
  fileType: string
  fileData: string
  fileSize: number
}

interface SectionFormResponsePayload {
  responseJson: Record<string, unknown>
  status: 'draft' | 'submitted'
  document: DocumentFile | null
}

const MAX_DOCUMENT_FILE_BYTES = 8_000_000

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function triggerDownload(dataUrl: string, fileName: string) {
  const link = window.document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

/** Fills (or, in readOnly mode, just displays) one section's form — reused by both the founder
 * and mentor "fill programs" pages, which hit different API paths but the same response shape. */
export function FillSectionFormDialog({
  open,
  onOpenChange,
  fetchUrl,
  saveUrl,
  queryKey,
  invalidateKey,
  readOnly,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fetchUrl: string
  saveUrl: string
  queryKey: unknown[]
  invalidateKey: unknown[]
  readOnly?: boolean
  onSaved: (result?: { feedbackForm?: { mappingId: number; mandatory: boolean; template: { id: number; title: string } } | null }) => void
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const [documentFile, setDocumentFile] = useState<DocumentFile | null>(null)
  const [initializedFor, setInitializedFor] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ form: FormWithSchema; response: SectionFormResponsePayload | null }>(fetchUrl)).data,
    enabled: open,
  })

  const formKey = queryKey.join('-')
  if (data && initializedFor !== formKey) {
    setInitializedFor(formKey)
    setDocumentFile(data.response?.document ?? null)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.size > MAX_DOCUMENT_FILE_BYTES) {
      toast.error(t('founderPrograms.form.documentTooLarge'))
      return
    }
    const fileData = await readFileAsDataUrl(picked)
    setDocumentFile({ fileName: picked.name, fileType: picked.type || 'application/octet-stream', fileData, fileSize: picked.size })
  }

  const mutation = useMutation({
    mutationFn: async ({ responseJson, status }: { responseJson: Record<string, unknown>; status: 'draft' | 'submitted' }) =>
      (await api.put(saveUrl, { responseJson, status, document: documentFile })).data,
    onSuccess: (result, { status }) => {
      toast.success(status === 'submitted' ? t('founderPrograms.form.toast.submitted') : t('founderPrograms.form.toast.saved'))
      queryClient.invalidateQueries({ queryKey: invalidateKey })
      onSaved(result)
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.form.toast.saveFailed'))),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.form.name ?? '…'}</DialogTitle>
          <DialogDescription>{readOnly ? t('founderPrograms.form.viewDescription') : t('founderPrograms.form.description')}</DialogDescription>
        </DialogHeader>

        {data && (
          <>
            <div className="space-y-1.5">
              <Label>{t('founderPrograms.form.documentLabel')}</Label>
              {readOnly ? (
                documentFile ? (
                  <Button variant="outline" size="sm" onClick={() => triggerDownload(documentFile.fileData, documentFile.fileName)}>
                    <Download className="h-3.5 w-3.5" /> {documentFile.fileName}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('founderPrograms.form.noDocument')}</p>
                )
              ) : documentFile ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span className="text-sm truncate">{documentFile.fileName}</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDocumentFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Input type="file" onChange={handleFileChange} />
              )}
              {!readOnly && <p className="text-xs text-muted-foreground">{t('founderPrograms.form.documentHint')}</p>}
            </div>

            <DynamicForm
              schema={data.form.schema}
              initialData={data.response?.responseJson}
              category={data.form.category}
              requireConsent={data.form.requireConsent}
              consentTermsText={data.form.consentTermsText}
              viewMode={readOnly}
              onSubmit={async (responseJson, status) => mutation.mutateAsync({ responseJson, status })}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

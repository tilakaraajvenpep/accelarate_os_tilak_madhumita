import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

import { Loader } from '@/components/ui/loader'

interface DocumentFileData {
  fileName: string
  fileType: string
  fileData: string
}

function triggerDownload(dataUrl: string, fileName: string) {
  const link = window.document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

/**
 * Lazily fetches and previews a founder/mentor-attached document (image inline,
 * PDF embedded, otherwise download-only) — used everywhere a document's contents
 * need to be shown without a full download. By default renders its own toggle
 * button; pass `open`/`onOpenChange` + `hideTrigger` to drive it from an external
 * trigger instead (e.g. an icon button already present in a row).
 */
export function DocumentPreview({
  fetchUrl,
  fileName,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: {
  fetchUrl: string
  fileName: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const { t } = useTranslation('common')
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const { data, isLoading } = useQuery({
    queryKey: ['document-preview', fetchUrl],
    queryFn: async () => (await api.get<DocumentFileData>(fetchUrl)).data,
    enabled: open,
  })

  return (
    <div className="space-y-2">
      {!hideTrigger && (
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          <FileText className="h-3.5 w-3.5" />
          {fileName}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      )}

      {open && (
        <div className="rounded-lg border bg-muted/20 p-2">
          {isLoading ? (
            <Loader text={t('documentPreview.loading')} size="sm" />
          ) : !data ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{t('documentPreview.loadError')}</p>
          ) : data.fileType.startsWith('image/') ? (
            <img src={data.fileData} alt={data.fileName} className="max-h-72 max-w-full rounded object-contain mx-auto" />
          ) : data.fileType === 'application/pdf' ? (
            <iframe src={data.fileData} title={data.fileName} className="w-full h-80 rounded border-0 bg-white" />
          ) : (
            <p className="text-xs text-muted-foreground py-2 text-center">{t('documentPreview.noPreview')}</p>
          )}
          {data && (
            <div className="flex justify-end mt-1.5">
              <Button variant="ghost" size="sm" onClick={() => triggerDownload(data.fileData, data.fileName)}>
                <Download className="h-3.5 w-3.5" /> {t('documentPreview.download')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

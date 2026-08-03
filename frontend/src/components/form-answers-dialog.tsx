import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DocumentPreview } from '@/components/document-preview'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

import { Loader } from '@/components/ui/loader'

export interface CompanyFormAnswer {
  programName: string
  pillarTitle: string
  sectionTitle: string
  sectionId: number
  formId: number
  formName: string
  submittedAt: string | null
  answers: { questionTitle: string; value: unknown }[]
  document: { fileName: string; fileType: string; fileSize: number } | null
}

function formatQuestionTitle(title: string): string {
  if (!title) return title
  let formatted = title.startsWith('_') ? title.slice(1) : title
  if (!formatted.includes(' ')) {
    formatted = formatted.replace(/[_-]+/g, ' ')
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2')
    formatted = formatted
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  return formatted
}

function formatAnswerValue(value: unknown, questionTitle?: string): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) {
    return value.map((v) => formatAnswerValue(v, questionTitle)).join(', ')
  }
  if (typeof value === 'boolean') {
    if (questionTitle?.toLowerCase().includes('consent') || questionTitle?.toLowerCase().includes('agree')) {
      return value ? 'Accepted' : 'Declined'
    }
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'string') {
    const valLower = value.toLowerCase().trim()
    if (valLower === 'true') {
      if (questionTitle?.toLowerCase().includes('consent') || questionTitle?.toLowerCase().includes('agree')) {
        return 'Accepted'
      }
      return 'Yes'
    }
    if (valLower === 'false') {
      if (questionTitle?.toLowerCase().includes('consent') || questionTitle?.toLowerCase().includes('agree')) {
        return 'Declined'
      }
      return 'No'
    }
  }
  return String(value)
}

/** Read-only viewer for a company's submitted form answers, in plain question/answer text — shared by the admin Cohorts page and the mentor Assignments page. */
export function FormAnswersDialog({
  open,
  onOpenChange,
  title,
  queryKey,
  queryFn,
  enabled,
  documentUrlBase,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  queryKey: unknown[]
  queryFn: () => Promise<CompanyFormAnswer[]>
  enabled: boolean
  /** Base path (e.g. `/api/tenants/me/cohorts/1/companies/5`) this dialog appends `/sections/:id/forms/:id/document` to for downloads. */
  documentUrlBase: string
}) {
  const { t } = useTranslation('cohorts')
  const { data, isLoading } = useQuery({ queryKey, queryFn, enabled })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('companies.answersDialog.title', { name: title })}</DialogTitle>
          <DialogDescription>{t('companies.answersDialog.description')}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Loader text={t('common:loading')} />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('companies.answersDialog.empty')}</p>
        ) : (
          <div className="space-y-3">
            {data.map((entry) => (
              <div key={entry.formId + entry.sectionTitle} className="rounded-lg border p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm border-b pb-2 mb-2">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block mb-0.5">Form Name</span>
                    <span className="font-semibold text-foreground">{entry.formName}</span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-xs font-semibold text-muted-foreground block mb-0.5">Program Name</span>
                    <span className="text-muted-foreground text-xs">
                      {entry.programName} · {entry.pillarTitle} · {entry.sectionTitle}
                    </span>
                  </div>
                </div>
                <div className="space-y-3.5 text-sm">
                  {entry.answers.map((a, i) => (
                    <div key={i} className="space-y-2 border-b last:border-b-0 pb-3 last:pb-0">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-wider block">Question</span>
                        <span className="font-semibold text-foreground">{formatQuestionTitle(a.questionTitle)}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-wider block">Answer</span>
                        <span className="break-words text-foreground">{formatAnswerValue(a.value, a.questionTitle)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {entry.document && (
                  <DocumentPreview
                    fetchUrl={`${documentUrlBase}/sections/${entry.sectionId}/forms/${entry.formId}/document`}
                    fileName={entry.document.fileName}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

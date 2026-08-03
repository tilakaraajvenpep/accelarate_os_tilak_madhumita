import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DynamicForm } from '@/components/dynamic-form'
import type { FormQuestion } from '@/types/forms'

interface CohortFormWithSchema {
  id: number
  title: string
  schema: FormQuestion[]
  category: string
  requireConsent: boolean
  consentTermsText: string | null
}

interface CohortFormResponsePayload {
  responseJson: Record<string, unknown>
  status: 'draft' | 'submitted'
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

export function FillCohortFormDialog({
  open,
  onOpenChange,
  formId,
  readOnly,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: number
  readOnly: boolean
  onSaved: () => void
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['founder-cohort-form', formId],
    queryFn: async () =>
      (await api.get<{ locked: boolean; readOnly: boolean; form: CohortFormWithSchema; response: CohortFormResponsePayload | null }>(
        `/api/tenants/me/founder/cohort-forms/${formId}`,
      )).data,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async ({ responseJson, status }: { responseJson: Record<string, unknown>; status: 'draft' | 'submitted' }) =>
      (await api.put(`/api/tenants/me/founder/cohort-forms/${formId}/response`, { responseJson, status })).data,
    onSuccess: (_result, { status }) => {
      toast.success(status === 'submitted' ? t('founderPrograms.form.toast.submitted') : t('founderPrograms.form.toast.saved'))
      queryClient.invalidateQueries({ queryKey: ['founder-cohort-forms'] })
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.form.toast.saveFailed'))),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.form.title ?? '…'}</DialogTitle>
          <DialogDescription>
            {readOnly ? t('founderPrograms.cohortForms.viewOnlyDescription') : t('founderPrograms.form.description')}
          </DialogDescription>
        </DialogHeader>

        {data && (
          <DynamicForm
            schema={data.form.schema}
            initialData={data.response?.responseJson}
            category={data.form.category}
            requireConsent={data.form.requireConsent}
            consentTermsText={data.form.consentTermsText}
            viewMode={readOnly}
            onSubmit={async (responseJson, status) => mutation.mutateAsync({ responseJson, status })}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

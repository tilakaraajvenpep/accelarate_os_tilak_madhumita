import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DynamicForm } from '@/components/dynamic-form'
import type { FormQuestion } from '@/types/forms'

interface ProgramFeedbackState {
  mapping: { id: number; mandatory: boolean; collaborationMode: string }
  template: { id: number; title: string; schema: FormQuestion[] }
  response: { responseJson: Record<string, unknown>; status: 'draft' | 'submitted'; dismissedAt: string | null } | null
  access: 'fillable' | 'view_only'
  pending: boolean
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

export function ProgramFeedbackModal({
  programId,
  companyId,
  open,
  onClose,
}: {
  programId: number
  companyId?: number
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const suffix = companyId ? `?companyId=${companyId}` : ''
  const queryKey = ['program-feedback', programId, companyId]

  const { data: state, isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<ProgramFeedbackState | null>(`/api/programs/${programId}/feedback${suffix}`)).data,
    enabled: open,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ responseJson, submit }: { responseJson: Record<string, unknown>; submit: boolean }) =>
      (await api.put(`/api/programs/${programId}/feedback${suffix}`, { responseJson, submit })).data,
    onSuccess: (_data, { submit }) => {
      queryClient.invalidateQueries({ queryKey })
      if (submit) {
        toast.success(t('feedback.toast.submitted'))
        onClose()
      } else {
        toast.success(t('feedback.toast.draftSaved'))
      }
    },
    onError: (err) => toast.error(apiError(err, t('feedback.toast.saveFailed'))),
  })

  const dismissMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/programs/${programId}/feedback/dismiss${suffix}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      onClose()
    },
    onError: (err) => toast.error(apiError(err, t('feedback.toast.skipFailed'))),
  })

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state?.template.title ?? t('feedback.titleFallback')}</DialogTitle>
          <DialogDescription>
            {state?.mapping.mandatory ? t('feedback.mandatoryDescription') : t('feedback.optionalDescription')}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !state ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('feedback.loading')}</p>
        ) : (
          <>
            <DynamicForm
              category="feedback"
              schema={state.template.schema}
              initialData={state.response?.responseJson}
              readOnly={state.access === 'view_only'}
              onSubmit={async (data, status) => {
                await saveMutation.mutateAsync({ responseJson: data, submit: status === 'submitted' })
              }}
            />

            {state.access === 'fillable' && !state.mapping.mandatory && (
              <div className="flex justify-end border-t pt-3">
                <Button variant="ghost" size="sm" onClick={() => dismissMutation.mutate()} disabled={dismissMutation.isPending}>
                  {t('feedback.skipButton')}
                </Button>
              </div>
            )}

            {state.access === 'view_only' && (
              <p className="text-xs text-muted-foreground">
                {state.response?.status === 'submitted' ? t('feedback.alreadySubmittedNote') : t('feedback.noPermissionNote')}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

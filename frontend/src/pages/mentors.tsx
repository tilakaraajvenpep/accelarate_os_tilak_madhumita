import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Users, Trash2, ChevronDown, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useConfirm } from '@/components/confirm-dialog'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { UserPermissionsDialog, type PermissionUser } from '@/components/user-permissions-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface MentorEntry {
  id: string
  status: 'active' | 'invited' | 'expired' | 'inactive'
  name: string | null
  email: string
  specialization: string | null
  createdAt: string
  allowedMenus?: string[] | null
  canSetPermissions?: boolean
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

function statusBadge(status: MentorEntry['status']): { label: string; variant: 'success' | 'secondary' | 'destructive' | 'warning' } {
  if (status === 'active') return { label: 'Active', variant: 'success' }
  if (status === 'inactive') return { label: 'Inactive', variant: 'secondary' }
  if (status === 'expired') return { label: 'Expired', variant: 'destructive' }
  return { label: 'Invited', variant: 'warning' }
}

export default function MentorsPage() {
  const { user } = useAuth()
  const { t } = useTranslation('mentors')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [permissionsUser, setPermissionsUser] = useState<PermissionUser | null>(null)

  const canAccess = user?.role === 'admin' || user?.role === 'mentor'

  const { data: mentors = [], isLoading } = useQuery({
    queryKey: ['mentors'],
    queryFn: async () => (await api.get<MentorEntry[]>('/api/tenants/me/mentors')).data,
    enabled: canAccess,
  })

  const inviteMutation = useMutation({
    mutationFn: async () => (await api.post('/api/tenants/me/mentor-invites', { name, email })).data,
    onSuccess: () => {
      toast.success(t('inviteDialog.toast.sent'))
      queryClient.invalidateQueries({ queryKey: ['mentors'] })
      setDialogOpen(false)
      setName('')
      setEmail('')
    },
    onError: (err) => toast.error(apiError(err, t('inviteDialog.toast.failed'))),
  })

  const [activeMentorId, setActiveMentorId] = useState<number | null>(null)

  const { data: assignments = [], isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ['mentor-assignments', activeMentorId],
    queryFn: async () => {
      if (!activeMentorId) return []
      return (await api.get<{ cohortId: number; cohortName: string; pillarId: number; pillarTitle: string }[]>(`/api/tenants/me/mentors/${activeMentorId}/assignments`)).data
    },
    enabled: activeMentorId !== null,
  })

  const uniqueCohortAssignments = Array.from(
    new Map(assignments.map((a) => [a.cohortId, { id: a.cohortId, name: a.cohortName }])).values()
  )

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ mentorId, disabled }: { mentorId: number; disabled: boolean }) =>
      (await api.patch(`/api/tenants/me/mentors/${mentorId}/status`, { disabled })).data,
    onSuccess: () => {
      toast.success(t('actions.toast.statusUpdated'))
      queryClient.invalidateQueries({ queryKey: ['mentors'] })
    },
    onError: (err) => toast.error(apiError(err, t('actions.toast.statusUpdateFailed'))),
  })

  const removeCohortMutation = useMutation({
    mutationFn: async ({ mentorId, cohortId }: { mentorId: number; cohortId: number }) =>
      (await api.delete(`/api/tenants/me/mentors/${mentorId}/cohorts/${cohortId}`)).data,
    onSuccess: () => {
      toast.success(t('actions.toast.removedFromCohort'))
      queryClient.invalidateQueries({ queryKey: ['mentor-assignments', activeMentorId] })
    },
    onError: (err) => toast.error(apiError(err, t('actions.toast.removeFailed'))),
  })

  if (!canAccess) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t('notAvailable')}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t('page.inviteButton')}
        </Button>
      </div>

      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="font-semibold">{t('table.cardTitle')}</h2>
        </div>
        <div className="px-6 py-4 border-b grid grid-cols-5 text-xs font-medium text-muted-foreground">
          <span>{t('table.name')}</span>
          <span>{t('table.email')}</span>
          <span>{t('table.specialization')}</span>
          <span className="text-center">{t('table.status')}</span>
          <span className="text-center">{t('actions.title')}</span>
        </div>
        {!isLoading && mentors.length === 0 && (
          <div className="text-center py-10">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
          </div>
        )}
        <div className="divide-y">
          {mentors.map((mentor) => {
            const badge = statusBadge(mentor.status)
            const isRealMentor = mentor.id.startsWith('mentor-')
            const dbId = Number(mentor.id.split('-')[1])
            return (
              <div key={mentor.id} className="grid grid-cols-5 items-center gap-3 px-6 py-3 text-sm">
                <span className="font-medium truncate">{mentor.name ?? '—'}</span>
                <span className="text-muted-foreground truncate">{mentor.email}</span>
                <span className="text-muted-foreground truncate">{mentor.specialization ?? '—'}</span>
                <div className="flex items-center justify-center gap-3">
                   <Badge variant={badge.variant} className="w-fit">{t(`statusOptions.${mentor.status}`, badge.label)}</Badge>
                  {isRealMentor && (
                    <Switch
                      checked={mentor.status === 'active'}
                      onCheckedChange={(checked) => {
                        toggleStatusMutation.mutate({ mentorId: dbId, disabled: !checked })
                      }}
                      size="sm"
                      aria-label="Toggle active status"
                    />
                  )}
                </div>
                <div className="flex items-center justify-center gap-2">
                  {isRealMentor && (
                    <>
                      {(user?.role === 'admin' || user?.canSetPermissions) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setPermissionsUser({
                              id: dbId,
                              name: mentor.name,
                              email: mentor.email,
                              role: 'mentor',
                              allowedMenus: mentor.allowedMenus ?? null,
                              canSetPermissions: !!mentor.canSetPermissions,
                            })
                            setPermissionsOpen(true)
                          }}
                          title="Permissions"
                        >
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <DropdownMenu onOpenChange={(open) => { if (open) setActiveMentorId(dbId) }}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 flex items-center gap-1.5">
                            {t('actions.cohortsButton')} <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64" align="end">
                          <DropdownMenuLabel className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                            {t('actions.assignedCohortsLabel')}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {activeMentorId === dbId && isAssignmentsLoading ? (
                            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin text-primary" />
                              {t('actions.loadingAssignments')}
                            </div>
                          ) : activeMentorId === dbId && uniqueCohortAssignments.length === 0 ? (
                            <div className="p-3 text-xs text-muted-foreground">
                              {t('actions.noAssignments')}
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto p-1 space-y-1">
                              {uniqueCohortAssignments.map((cohort) => (
                                <div
                                  key={cohort.id}
                                  className="flex items-center justify-between gap-2 p-1.5 pl-2.5 text-xs hover:bg-accent/40 rounded-md transition-colors"
                                >
                                  <span className="font-medium truncate flex-1">{cohort.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-md hover:bg-destructive/10 text-destructive hover:text-destructive-foreground focus:bg-destructive/20 focus:text-destructive-foreground"
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const ok = await confirm({
                                        title: 'Confirm Deletion',
                                        description: 'Are you sure you want to remove this assignment? This action cannot be undone.',
                                        confirmLabel: 'Delete',
                                        variant: 'destructive',
                                      })
                                      if (ok) {
                                        removeCohortMutation.mutate({ mentorId: dbId, cohortId: cohort.id })
                                      }
                                    }}
                                    disabled={removeCohortMutation.isPending}
                                    title={t('actions.removeFromCohort')}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('inviteDialog.title')}</DialogTitle>
            <DialogDescription>{t('inviteDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label required>{t('inviteDialog.nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('inviteDialog.namePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label required>{t('inviteDialog.emailLabel')}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('inviteDialog.emailPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button disabled={!name.trim() || !email.trim() || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
              {t('inviteDialog.sendButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserPermissionsDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        user={permissionsUser}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['mentors'] })}
      />
    </div>
  )
}

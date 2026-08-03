import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Users, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from '@/context/auth-context'
import { useViewAsCompany } from '@/context/view-as-context'
import { useConfirm } from '@/components/confirm-dialog'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useListControls } from '@/hooks/use-list-controls'
import type { Company } from '@/types/company'
import type { CompanyMember } from '@/types/forms'
import { UserPermissionsDialog, type PermissionUser } from '@/components/user-permissions-dialog'

interface ViewAsCompanyInfo {
  id: number
  name: string | null
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

export default function CompanyTeamPage() {
  const { t } = useTranslation('companyTeam')
  const { user } = useAuth()
  const navigate = useNavigate()
  const viewAs = useViewAsCompany()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [permissionsUser, setPermissionsUser] = useState<PermissionUser | null>(null)

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['my-company', viewAs?.companyId],
    queryFn: async (): Promise<Company | ViewAsCompanyInfo | null> =>
      viewAs
        ? (await api.get<ViewAsCompanyInfo>(`/api/tenants/me/companies/${viewAs.companyId}/view-as`)).data
        : (await api.get<Company | null>('/api/tenants/me/companies/mine')).data,
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['company-members', company?.id],
    queryFn: async () =>
      (
        await api.get<CompanyMember[]>(
          viewAs ? `/api/tenants/me/companies/${company!.id}/view-as/team` : `/api/tenants/me/companies/${company!.id}/members`,
        )
      ).data,
    enabled: !!company,
  })

  const controls = useListControls(members, {
    searchFields: (m) => [m.name, m.email],
  })

  const inviteMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/tenants/me/companies/${company!.id}/members/invite`, { email })).data,
    onSuccess: () => {
      toast.success(t('toast.inviteSent'))
      handleInviteOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.inviteFailed'))),
  })

  const removeMutation = useMutation({
    mutationFn: async (userId: number) => (await api.delete(`/api/tenants/me/companies/${company!.id}/members/${userId}`)).data,
    onSuccess: () => {
      toast.success(t('toast.memberRemoved'))
      queryClient.invalidateQueries({ queryKey: ['company-members', company?.id] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.removeFailed'))),
  })

  async function handleRemove(m: CompanyMember) {
    const ok = await confirm({
      title: t('removeDialog.title'),
      description: t('removeDialog.description', { name: m.name ?? m.email }),
      confirmLabel: t('removeDialog.confirmButton'),
      variant: 'destructive',
    })
    if (!ok) return
    removeMutation.mutate(m.userId)
  }

  function handleInviteOpenChange(next: boolean) {
    if (!next) setEmail('')
    setInviteOpen(next)
  }

  if (companyLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 flex justify-center">
        <Loader />
      </div>
    )
  }

  const notReady = !company || (!viewAs && 'status' in company && company.status !== 'locked')
  if (!companyLoading && notReady) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="surface-card p-8 text-center space-y-3">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
          <p className="text-muted-foreground text-sm">{t('notSetUp.message')}</p>
          {!viewAs && (
            <Button onClick={() => navigate('/accept-invite')}>
              {t('notSetUp.completeButton')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('page.subtitle', { companyName: company?.name ?? t('page.defaultCompanyName') })}
          </p>
        </div>
        {!viewAs && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> {t('page.inviteButton')}
          </Button>
        )}
      </div>

      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-semibold">{t('members.title')}</h2>
        </div>
        <div className="px-6 py-3 border-b">
          <ListToolbar controls={controls} searchPlaceholder={t('common:search')} />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:name')}</TableHead>
                <TableHead>{t('common:email')}</TableHead>
                <TableHead>{t('table.joined')}</TableHead>
                <TableHead className="text-center">{t('common:actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10">
                    <Loader />
                  </TableCell>
                </TableRow>
              ) : (
                controls.paged.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">{m.name ?? '—'}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {!viewAs && (user?.role === 'admin' || user?.canSetPermissions) && m.userId !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setPermissionsUser({
                                id: m.userId,
                                name: m.name,
                                email: m.email,
                                role: 'founder',
                                allowedMenus: m.allowedMenus ?? null,
                                canSetPermissions: !!m.canSetPermissions,
                              })
                              setPermissionsOpen(true)
                            }}
                            title="Permissions"
                          >
                            <ShieldCheck className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {!viewAs && m.userId !== user?.id && members.length > 1 && (
                          <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(m)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!membersLoading && controls.paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    {t('table.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 py-3 border-t">
          <ListPagination controls={controls} />
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('inviteDialog.title')}</DialogTitle>
            <DialogDescription>{t('inviteDialog.description', { companyName: company?.name })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label required>{t('common:email')}</Label>
            <Input type="email" placeholder={t('inviteDialog.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleInviteOpenChange(false)}>
              {t('common:cancel')}
            </Button>
            <Button disabled={!email.trim() || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
              {t('inviteDialog.sendButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserPermissionsDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        user={permissionsUser}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['company-members', company?.id] })}
      />
    </div>
  )
}

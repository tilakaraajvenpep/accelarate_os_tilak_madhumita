import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Building2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { CompanyEntry, CompanyEntryStatus, CompanyInviteResult } from '@/types/company'

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}

function statusBadge(status: CompanyEntryStatus): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (status === 'active') return { label: 'Active', variant: 'default' }
  if (status === 'expired') return { label: 'Expired', variant: 'destructive' }
  return { label: 'Invited', variant: 'secondary' }
}

export default function CompaniesPage() {
  const { user } = useAuth()
  const { t } = useTranslation('companies')
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['company-entries'],
    queryFn: async () => (await api.get<CompanyEntry[]>('/api/tenants/me/companies')).data,
    enabled: user?.role === 'admin',
  })

  if (user?.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t('notAvailable')}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t('page.createButton')}
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('table.cardTitle')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.company')}</TableHead>
              <TableHead>{t('table.founder')}</TableHead>
              <TableHead>{t('table.email')}</TableHead>
              <TableHead>{t('common:status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const badge = statusBadge(entry.status)
              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.name ?? t('table.pendingCompanyName')}</TableCell>
                  <TableCell>{entry.founderName ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.email}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{t(`status.${entry.status}`, badge.label)}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
            {!isLoading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  {t('table.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateCompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onInvited={() => queryClient.invalidateQueries({ queryKey: ['company-entries'] })}
      />
    </div>
  )
}

function CreateCompanyDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: () => void
}) {
  const { t } = useTranslation('companies')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function reset() {
    setName('')
    setEmail('')
  }

  const mutation = useMutation({
    mutationFn: async () => (await api.post<CompanyInviteResult>('/api/tenants/me/company-invites', { name, email })).data,
    onSuccess: () => {
      toast.success(t('dialog.inviteSent'))
      onInvited()
      onOpenChange(false)
      reset()
    },
    onError: (err) => toast.error(apiError(err, t('dialog.inviteFailed'))),
  })

  const formValid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email)

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('dialog.nameLabel')}</Label>
            <Input value={name} placeholder={t('dialog.namePlaceholder')} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t('dialog.emailLabel')}</Label>
            <Input type="email" value={email} placeholder={t('dialog.emailPlaceholder')} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {t('dialog.sendInviteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

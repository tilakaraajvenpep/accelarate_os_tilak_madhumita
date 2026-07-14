import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import type { SuperAdmin } from '@/types/admin'
import { PASSWORD_PATTERN, PASSWORD_HINT } from '@/lib/validation'

export default function SuperAdminsPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SuperAdmin | null>(null)
  const [deleting, setDeleting] = useState<SuperAdmin | null>(null)

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['super-admins'],
    queryFn: async () => (await api.get<SuperAdmin[]>('/api/super-admins')).data,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['super-admins'] })
  }

  const toggleActiveMutation = useMutation({
    mutationFn: async (params: { id: number; active: boolean }) =>
      (await api.patch(`/api/super-admins/${params.id}/active`, { active: params.active })).data,
    onSuccess: () => {
      invalidate()
    },
    onError: (err) => toast.error(apiError(err, 'Failed to update status')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/super-admins/${id}`)).data,
    onSuccess: () => {
      toast.success('Super admin deleted')
      invalidate()
      setDeleting(null)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to delete super admin')),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Super Admins</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Grant platform-level access. New admins verify their email before their account is created.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New super admin
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Current super admins</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => {
              const isSelf = admin.id === currentUser?.id
              return (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.active ? 'default' : 'secondary'}>
                      {admin.active ? 'Active' : 'Inactive'}
                    </Badge>
                    {!admin.emailVerified && (
                      <Badge variant="outline" className="ml-2">
                        Unverified
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={admin.active}
                        disabled={isSelf || toggleActiveMutation.isPending}
                        title={isSelf ? "You can't change your own status" : undefined}
                        onCheckedChange={(checked: boolean) =>
                          toggleActiveMutation.mutate({ id: admin.id, active: checked })
                        }
                      />
                      <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => setEditing(admin)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={isSelf ? "You can't delete your own account" : 'Delete'}
                        disabled={isSelf || deleteMutation.isPending}
                        onClick={() => setDeleting(admin)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {!isLoading && admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  No super admins yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSuperAdminDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={invalidate} />
      <EditSuperAdminDialog admin={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={invalidate} />
      <DeleteSuperAdminDialog
        admin={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        pending={deleteMutation.isPending}
      />
    </div>
  )
}

type CreateStep = 'form' | 'otp'

interface CreateForm {
  name: string
  email: string
  password: string
}

const EMPTY_CREATE_FORM: CreateForm = { name: '', email: '', password: '' }

function CreateSuperAdminDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<CreateStep>('form')
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE_FORM)
  const [otp, setOtp] = useState('')

  function handleOpenChange(next: boolean) {
    if (next) {
      setStep('form')
      setForm(EMPTY_CREATE_FORM)
      setOtp('')
    }
    onOpenChange(next)
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/api/super-admins', {
          name: form.name || undefined,
          email: form.email,
          password: form.password,
        })
      ).data as { emailSent: boolean }
    },
    onSuccess: (data) => {
      toast.success(
        data.emailSent
          ? `Verification code sent to ${form.email}`
          : `Account created, but the verification email failed to send — check SES config`,
      )
      setStep('otp')
    },
    onError: (err) => toast.error(apiError(err, 'Failed to create super admin')),
  })

  const verifyMutation = useMutation({
    mutationFn: async () => (await api.post('/api/super-admins/verify-otp', { email: form.email, code: otp })).data,
    onSuccess: () => {
      toast.success('Super admin verified and activated')
      onCreated()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, 'Verification failed')),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>New super admin</DialogTitle>
              <DialogDescription>
                We'll email a 6-digit code to verify their email before the account is created.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name (optional)</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.email || !PASSWORD_PATTERN.test(form.password)}
              >
                Send verification code
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'otp' && (
          <>
            <DialogHeader>
              <DialogTitle>Verify email</DialogTitle>
              <DialogDescription>Enter the 6-digit code we sent to {form.email}.</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label>Verification code</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.4em] font-mono"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending || otp.length !== 6}>
                Verify &amp; activate
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditSuperAdminDialog({
  admin,
  onOpenChange,
  onSaved,
}: {
  admin: SuperAdmin | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '' })
  const [lastAdminId, setLastAdminId] = useState<number | null | undefined>(undefined)

  if (admin && admin.id !== lastAdminId) {
    setLastAdminId(admin.id)
    setForm({ name: admin.name ?? '', email: admin.email })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admin) throw new Error('No super admin selected')
      return (await api.patch(`/api/super-admins/${admin.id}`, { name: form.name, email: form.email })).data
    },
    onSuccess: () => {
      toast.success('Super admin updated')
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to save changes')),
  })

  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit super admin</DialogTitle>
          <DialogDescription>Update this super admin's name and email.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name (optional)</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Changing this re-issues their login — a new temporary password is emailed to the new address.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.email}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteSuperAdminDialog({
  admin,
  onOpenChange,
  onConfirm,
  pending,
}: {
  admin: SuperAdmin | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete super admin</DialogTitle>
          <DialogDescription>
            Permanently remove "{admin?.name || admin?.email}" as a super admin? This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}

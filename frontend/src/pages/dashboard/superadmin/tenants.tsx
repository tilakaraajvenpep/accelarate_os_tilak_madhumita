import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Building2, Dices, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type { Tenant, OrgType } from '@/types/billing'

const ORG_TYPES: { label: string; value: OrgType }[] = [
  { label: 'University accelerator', value: 'university' },
  { label: 'Corporate accelerator', value: 'corporate' },
  { label: 'VC-backed accelerator', value: 'vc_backed' },
  { label: 'Government / nonprofit', value: 'government' },
  { label: 'Independent accelerator', value: 'independent' },
  { label: 'Other', value: 'other' },
]

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function TenantsAdminPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  const deleteMutation = useMutation({
    mutationFn: async (tenantId: number) => (await api.delete(`/api/tenants/${tenantId}`)).data,
    onSuccess: () => {
      toast.success('Tenant deleted')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err) => toast.error(apiError(err, 'Failed to delete tenant')),
  })

  function handleDelete(tenant: Tenant) {
    const confirmed = window.confirm(
      `Permanently delete "${tenant.name}"? This removes the tenant, its subscription/payment history, and its admin accounts (including their logins) — this cannot be undone.`,
    )
    if (!confirmed) return
    deleteMutation.mutate(tenant.id)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Onboard a new tenant and invite their admin.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Tenant
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">All Tenants</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Org type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell className="text-muted-foreground">{tenant.slug}</TableCell>
                <TableCell>{tenant.orgType ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={tenant.suspended ? 'secondary' : 'default'}>
                    {tenant.suspended ? 'Suspended' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete tenant"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(tenant)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  No tenants yet — create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['tenants'] })}
      />
    </div>
  )
}

interface CreateTenantForm {
  name: string
  orgType: OrgType | ''
  website: string
  slug: string
  slugTouched: boolean
  adminEmail: string
  adminName: string
  adminPassword: string
}

const EMPTY_FORM: CreateTenantForm = {
  name: '',
  orgType: '',
  website: '',
  slug: '',
  slugTouched: false,
  adminEmail: '',
  adminName: '',
  adminPassword: '',
}

function CreateTenantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<CreateTenantForm>(EMPTY_FORM)

  function handleOpenChange(next: boolean) {
    if (next) setForm(EMPTY_FORM)
    onOpenChange(next)
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/api/tenants', {
          name: form.name,
          orgType: form.orgType || undefined,
          website: form.website || undefined,
          slug: form.slug || undefined,
          adminEmail: form.adminEmail,
          adminName: form.adminName,
          adminPassword: form.adminPassword,
        })
      ).data
    },
    onSuccess: (data: { emailSent: boolean }) => {
      toast.success(
        data.emailSent
          ? `Verification email sent to ${form.adminEmail}`
          : `Tenant created, but the verification email failed to send — check SES config`,
      )
      onCreated()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to create tenant')),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create tenant</DialogTitle>
          <DialogDescription>
            Set the admin's password now — they'll just need to verify their email before signing in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Organization name</Label>
            <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: slugify(e.target.value), slugTouched: true })}
            />
            <p className="text-xs text-muted-foreground">Used to identify this tenant in URLs (/t/{form.slug || '…'})</p>
          </div>

          <div className="space-y-1.5">
            <Label>Org type</Label>
            <Select value={form.orgType} onValueChange={(v) => setForm({ ...form, orgType: (v as OrgType) ?? '' })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              type="url"
              placeholder="https://example.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Admin name</Label>
            <Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Admin email</Label>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Admin password</Label>
            <div className="flex gap-2">
              <Input
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                placeholder="Min. 8 characters"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generate a password"
                onClick={() => setForm({ ...form, adminPassword: generatePassword() })}
              >
                <Dices className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this with the admin securely — it won't be shown again after you close this dialog.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.name ||
              !form.adminEmail ||
              !form.adminName ||
              form.adminPassword.length < 8
            }
          >
            Create tenant
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

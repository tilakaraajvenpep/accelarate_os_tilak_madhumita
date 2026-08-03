import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader } from '@/components/ui/loader'

export interface PermissionUser {
  id: number
  name: string | null
  email: string
  role: 'mentor' | 'founder'
  allowedMenus: string[] | null
  canSetPermissions: boolean
}

interface UserPermissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: PermissionUser | null
  onSuccess?: () => void
}

interface MenuItem {
  titleKey: string
  href: string
}

const MENTOR_MENUS: MenuItem[] = [
  { titleKey: 'nav.overview', href: '/' },
  { titleKey: 'nav.myAssignments', href: '/mentor/assignments' },
  { titleKey: 'nav.fillPrograms', href: '/mentor/programs' },
  { titleKey: 'nav.allCohorts', href: '/mentor/cohorts' },
  { titleKey: 'nav.submittedAnswers', href: '/mentor/submitted-answers' },
  { titleKey: 'nav.governanceReview', href: '/mentor/governance/review' },
  { titleKey: 'nav.documents', href: '/documents' },
  { titleKey: 'nav.inviteMentors', href: '/mentors' },
  { titleKey: 'nav.tenantSettings', href: '/settings' },
]

const FOUNDER_MENUS: MenuItem[] = [
  { titleKey: 'nav.overview', href: '/' },
  { titleKey: 'nav.myPrograms', href: '/my-programs' },
  { titleKey: 'nav.team', href: '/team' },
  { titleKey: 'nav.documents', href: '/documents' },
  { titleKey: 'nav.calendar', href: '/calendar' },
  { titleKey: 'nav.messages', href: '/messages' },
  { titleKey: 'nav.governance', href: '/governance' },
]

export function UserPermissionsDialog({ open, onOpenChange, user, onSuccess }: UserPermissionsDialogProps) {
  const { t: tSidebar } = useTranslation('sidebar')
  const { t: tCommon } = useTranslation('common')
  const [selectedHrefs, setSelectedHrefs] = useState<string[]>([])
  const [canSetPerms, setCanSetPerms] = useState(false)
  const [saving, setSaving] = useState(false)

  const menus = user?.role === 'mentor' ? MENTOR_MENUS : FOUNDER_MENUS

  useEffect(() => {
    if (user) {
      setCanSetPerms(user.canSetPermissions)
      if (user.allowedMenus === null) {
        // If null, default to all menus being selected
        setSelectedHrefs(menus.map((m) => m.href))
      } else {
        setSelectedHrefs(user.allowedMenus)
      }
    }
  }, [user, open])

  if (!user) return null

  const handleToggleMenu = (href: string) => {
    setSelectedHrefs((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    )
  }

  const handleSelectAll = () => {
    setSelectedHrefs(menus.map((m) => m.href))
  }

  const handleClearAll = () => {
    setSelectedHrefs([])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // If all menus are selected, we can store allowedMenus as null (default/full access)
      // Otherwise, save the array.
      const isAllSelected = menus.every((m) => selectedHrefs.includes(m.href))
      const allowedMenus = isAllSelected ? null : selectedHrefs

      await api.patch(`/api/users/${user.id}/permissions`, {
        allowedMenus,
        canSetPermissions: canSetPerms,
      })

      toast.success(tCommon('toast.saveSuccess', 'Permissions saved successfully'))
      onOpenChange(false)
      onSuccess?.()
    } catch (err: unknown) {
      const errorMsg = (err as any)?.response?.data?.error || (err instanceof Error ? err.message : 'Failed to save permissions')
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {tSidebar('permissions.title', 'Menu Access Control')}
          </DialogTitle>
          <DialogDescription>
            {tSidebar('permissions.description', 'Configure sidebar visibility and administrative privileges for {{name}} ({{email}}).', {
              name: user.name || 'User',
              email: user.email,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Menu items selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {tSidebar('permissions.menus', 'Sidebar Menus')}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {tCommon('selectAll', 'Select All')}
                </button>
                <span className="text-muted-foreground/30 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:underline font-medium"
                >
                  {tCommon('clearAll', 'Clear All')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-glass-border bg-glass-1">
              {menus.map((item) => {
                const isChecked = selectedHrefs.includes(item.href)
                return (
                  <div key={item.href} className="flex items-center space-x-2.5">
                    <Checkbox
                      id={`menu-${item.href}`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggleMenu(item.href)}
                    />
                    <Label
                      htmlFor={`menu-${item.href}`}
                      className="text-sm font-medium text-ink/70 cursor-pointer select-none"
                    >
                      {tSidebar(item.titleKey)}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Admin grant privilege option */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-glass-border bg-glass-1">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="can-set-permissions" className="text-sm font-semibold text-foreground">
                {tSidebar('permissions.delegateLabel', 'Delegate Permissions Setting')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {tSidebar(
                  'permissions.delegateDescription',
                  'Allow this user to manage menu visibility and permissions for other users of the same role.'
                )}
              </p>
            </div>
            <Switch
              id="can-set-permissions"
              checked={canSetPerms}
              onCheckedChange={setCanSetPerms}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[80px]">
            {saving ? <Loader className="h-4 w-4" /> : tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

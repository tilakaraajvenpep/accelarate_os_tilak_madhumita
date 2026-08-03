import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AppNotification } from '@/types/notification'

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function NotificationBell({ className }: { className?: string }) {
  const { t } = useTranslation('header')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => (await api.get<{ count: number }>('/api/tenants/me/notifications/unread-count')).data.count,
    refetchInterval: 60000,
  })

  const { data: notificationsList = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<AppNotification[]>('/api/tenants/me/notifications')).data,
    enabled: open,
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => (await api.patch(`/api/tenants/me/notifications/${id}/read`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => (await api.post('/api/tenants/me/notifications/mark-all-read')).data,
    onSuccess: () => {
      toast.success(t('header:notifications.markAllReadToast'))
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  function handleClickNotification(notification: AppNotification) {
    if (!notification.readAt) markReadMutation.mutate(notification.id)
    setOpen(false)
    if (notification.link) navigate(notification.link)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "relative h-10 w-10 flex items-center justify-center rounded-lg border border-glass-border bg-glass hover:bg-glass-2 transition-colors text-ink/40 hover:text-ink/70",
          className
        )}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-[oklch(0.65_0.22_30)]" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">{t('header:notifications.title')}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3 w-3" /> {t('header:notifications.markAllRead')}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notificationsList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('header:notifications.empty')}</p>
          ) : (
            notificationsList.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleClickNotification(notification)}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b last:border-0 hover:bg-muted/50 transition-colors',
                  !notification.readAt && 'bg-primary/5',
                )}
              >
                <div className="flex items-start gap-2">
                  {!notification.readAt && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  <div className={cn('min-w-0', notification.readAt && 'pl-3.5')}>
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    {notification.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.body}</p>}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">{formatRelativeTime(notification.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

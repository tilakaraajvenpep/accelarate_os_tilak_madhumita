export interface AppNotification {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

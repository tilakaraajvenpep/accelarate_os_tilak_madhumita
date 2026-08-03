import { Outlet } from 'react-router-dom'
import { Header } from './header'
import { AiChatWidget } from '@/components/ai-chat/ai-chat-widget'

export function AppShell() {
  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-page w-full max-w-full">
      <Header />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-8 bg-page w-full max-w-full">
        <Outlet />
      </main>
      <AiChatWidget />
    </div>
  )
}

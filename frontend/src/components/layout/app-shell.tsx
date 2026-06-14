import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="relative flex h-screen overflow-hidden bg-page">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 h-[700px] w-[700px] rounded-full bg-[oklch(0.50_0.22_265)] opacity-[0.12] blur-[160px]" />
        <div className="absolute top-1/2 -translate-y-1/2 -right-40 h-[600px] w-[550px] rounded-full bg-[oklch(0.55_0.22_310)] opacity-[0.09] blur-[150px]" />
        <div className="absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full bg-[oklch(0.52_0.20_200)] opacity-[0.08] blur-[140px]" />
      </div>

      <Sidebar collapsed={collapsed} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

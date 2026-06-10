import { PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onToggleSidebar: () => void
  collapsed: boolean
}

export function Header({ onToggleSidebar, collapsed }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-3 px-4 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className={cn(
          'h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors text-muted-foreground',
        )}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <PanelLeft className="h-4 w-4" />
      </button>
    </header>
  )
}

import { BookOpen } from 'lucide-react'

export default function ProgramsPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Nothing to show here yet.</p>
      </div>
    </div>
  )
}

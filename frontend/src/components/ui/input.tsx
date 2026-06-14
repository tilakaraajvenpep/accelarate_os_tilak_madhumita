import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
        "disabled:pointer-events-none disabled:opacity-50",
        "backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }

import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'muted';
  text?: string;
  fullscreen?: boolean;
}

export function Loader({
  className,
  size = 'default',
  variant = 'default',
  text,
  fullscreen = false,
  ...props
}: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  }

  const variantClasses = {
    default: "text-foreground",
    primary: "text-primary",
    muted: "text-muted-foreground",
  }

  const containerClasses = cn(
    "flex flex-col items-center justify-center gap-3",
    fullscreen && "fixed inset-0 z-50 bg-background/80 backdrop-blur-xs h-screen w-screen",
    !fullscreen && "py-6",
    className
  )

  return (
    <div className={containerClasses} {...props}>
      <div className="relative flex items-center justify-center">
        {/* Subtle glow behind the spinner for a modern premium feel */}
        <div className={cn(
          "absolute inset-0 rounded-full blur-md opacity-25 animate-pulse",
          variant === 'primary' ? "bg-primary" : "bg-muted-foreground"
        )} />
        <Loader2 className={cn("animate-spin relative z-10", sizeClasses[size], variantClasses[variant])} />
      </div>
      {text && (
        <span className="text-sm font-medium text-muted-foreground animate-pulse">
          {text}
        </span>
      )}
    </div>
  )
}

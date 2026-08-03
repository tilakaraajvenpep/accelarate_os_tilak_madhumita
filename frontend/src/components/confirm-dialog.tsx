import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// Same non-explicit-close reasons as the Dialog wrapper — a confirmation
// prompt should only resolve via its own Cancel/Confirm button.
const NON_EXPLICIT_CLOSE_REASONS = new Set(['outside-press', 'escape-key', 'focus-out', 'close-watcher'])

/** Mounted once near the app root. Renders the single shared confirmation dialog and provides useConfirm() to the whole tree. */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common')
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => new Promise((resolve) => setState({ options, resolve })), [])

  function settle(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={!!state}
        onOpenChange={(open, eventDetails) => {
          if (!open) {
            if (NON_EXPLICIT_CLOSE_REASONS.has(eventDetails.reason)) return
            settle(false)
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-popover p-5 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {state && (
              <>
                <AlertDialog.Title className="font-heading text-base font-medium">{state.options.title}</AlertDialog.Title>
                {state.options.description && (
                  <AlertDialog.Description className="text-sm text-muted-foreground mt-1.5">
                    {state.options.description}
                  </AlertDialog.Description>
                )}
                <div className="flex justify-end gap-2 mt-5">
                  <Button variant="outline" onClick={() => settle(false)}>
                    {state.options.cancelLabel ?? t('cancel')}
                  </Button>
                  <Button variant={state.options.variant === 'destructive' ? 'destructive' : 'default'} onClick={() => settle(true)}>
                    {state.options.confirmLabel ?? t('confirm')}
                  </Button>
                </div>
              </>
            )}
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  )
}

/** Returns an async confirm(options) function — resolves true/false once the user picks a button. Replaces window.confirm/alert. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmDialogProvider>')
  return ctx
}

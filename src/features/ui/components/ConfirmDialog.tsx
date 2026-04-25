'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { Button } from '~/features/ui/components/Button'
import {
  DialogActions,
  DialogBackdrop,
  DialogBody,
  DialogPanel,
  DialogTitle,
} from '~/features/ui/components/Dialog'

export interface ConfirmOptions {
  title: string
  message?: string
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string
  /** Confirm-button visual style. Defaults to "primary"; use "danger" for destructive actions. */
  variant?: 'primary' | 'danger'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise(resolve => {
      setPending({ ...opts, resolve })
    })
  }, [])

  const handleResolve = (value: boolean) => {
    if (pending) {
      pending.resolve(value)
      setPending(null)
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <DialogBackdrop onClick={() => handleResolve(false)}>
          <DialogPanel onClick={e => e.stopPropagation()}>
            <DialogTitle>{pending.title}</DialogTitle>
            {pending.message && <DialogBody>{pending.message}</DialogBody>}
            <DialogActions>
              <Button variant="secondary" onClick={() => handleResolve(false)}>
                {pending.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={pending.variant ?? 'primary'}
                onClick={() => handleResolve(true)}
                autoFocus
              >
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </DialogActions>
          </DialogPanel>
        </DialogBackdrop>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmDialogProvider>')
  return ctx
}

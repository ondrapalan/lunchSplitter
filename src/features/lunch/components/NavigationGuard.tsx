'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Button } from '~/features/ui/components/Button'
import {
  DialogActions,
  DialogBackdrop,
  DialogBody,
  DialogPanel,
  DialogTitle,
} from '~/features/ui/components/Dialog'

interface PendingNav {
  resolve: (proceed: boolean) => void
}

interface NavigationGuardContextValue {
  isDirty: boolean
  setDirty: (key: string, dirty: boolean) => void
  // Returns true if the caller may navigate, false if the user cancelled.
  requestLeave: () => Promise<boolean>
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null)

export function useNavigationGuard(): NavigationGuardContextValue {
  // No-op default: if a consumer is mounted outside the provider, just allow nav.
  return useContext(NavigationGuardContext) ?? {
    isDirty: false,
    setDirty: () => {},
    requestLeave: async () => true,
  }
}

/**
 * Pushes the caller's dirty state up into the guard. Each call site uses a
 * unique `key` so multiple components can contribute. The signal is cleared
 * automatically on unmount and on key change.
 */
export function useGuardDirty(key: string, dirty: boolean) {
  const { setDirty } = useNavigationGuard()
  useEffect(() => {
    setDirty(key, dirty)
    return () => setDirty(key, false)
  }, [key, dirty, setDirty])
}

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const dirtyKeysRef = useRef<Set<string>>(new Set())
  const [isDirty, setIsDirty] = useState(false)
  const [pending, setPending] = useState<PendingNav | null>(null)
  const isDirtyRef = useRef(false)
  isDirtyRef.current = isDirty

  const setDirty = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeysRef.current.add(key)
    else dirtyKeysRef.current.delete(key)
    setIsDirty(dirtyKeysRef.current.size > 0)
  }, [])

  // Native browser dialog covers tab close / refresh / full-document navigation.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Custom modal for browser back/forward while staying on the App Router.
  // Push a sentinel state when dirty so the back button triggers our handler
  // instead of leaving the page; allow the back to proceed only if confirmed.
  useEffect(() => {
    if (!isDirty) return
    const sentinel = { __guard: true }
    window.history.pushState(sentinel, '', window.location.href)
    const handler = () => {
      if (!isDirtyRef.current) return
      window.history.pushState(sentinel, '', window.location.href)
      setPending({
        resolve: (proceed) => {
          if (proceed) {
            window.removeEventListener('popstate', handler)
            window.history.back()
          }
        },
      })
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [isDirty])

  const requestLeave = useCallback((): Promise<boolean> => {
    if (!isDirtyRef.current) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      setPending({ resolve })
    })
  }, [])

  const handleResolve = useCallback((proceed: boolean) => {
    if (!pending) return
    setPending(null)
    pending.resolve(proceed)
  }, [pending])

  return (
    <NavigationGuardContext.Provider value={{ isDirty, setDirty, requestLeave }}>
      {children}
      {pending && (
        <DialogBackdrop onClick={() => handleResolve(false)}>
          <DialogPanel onClick={e => e.stopPropagation()}>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogBody>
              You have unsaved fees, discount, or bank-account changes. They will be lost
              unless you close the order to commit them.
            </DialogBody>
            <DialogActions>
              <Button variant="secondary" onClick={() => handleResolve(false)}>Stay</Button>
              <Button variant="danger" onClick={() => handleResolve(true)}>Leave and discard</Button>
            </DialogActions>
          </DialogPanel>
        </DialogBackdrop>
      )}
    </NavigationGuardContext.Provider>
  )
}

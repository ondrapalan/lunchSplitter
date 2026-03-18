import { useRef, useCallback, useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  addItemToOrder,
  removeItemFromOrder,
  updateItemInOrder,
  addPersonToOrder,
  removePersonFromOrder,
  updatePersonInOrder,
} from '~/actions/orderItems'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface ItemChanges {
  name?: string
  price?: number
  discountPercent?: number | null
  sharedWith?: string[]
  customShares?: Record<string, number> | null
}

interface PendingItemUpdate {
  personId: string
  itemId: string
  changes: ItemChanges
}

interface UseAutoSaveOptions {
  orderId: string
  enabled: boolean
  onUpdatedAt?: (updatedAt: string) => void
}

export function useAutoSave({ orderId, enabled, onUpdatedAt }: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingChanges = useRef<Map<string, PendingItemUpdate>>(new Map())
  const activeSaves = useRef(0)
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear "Saved" indicator after 2s
  useEffect(() => {
    if (saveStatus === 'saved') {
      savedTimeout.current = setTimeout(() => setSaveStatus('idle'), 2000)
      return () => {
        if (savedTimeout.current) clearTimeout(savedTimeout.current)
      }
    }
  }, [saveStatus])

  // beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingChanges.current.size > 0 || activeSaves.current > 0) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  const execSave = useCallback(async (fn: () => Promise<unknown>): Promise<void> => {
    if (!enabled) return
    activeSaves.current++
    setSaveStatus('saving')
    try {
      const result = await fn()
      if (onUpdatedAt && result && typeof result === 'object' && 'updatedAt' in result) {
        onUpdatedAt((result as { updatedAt: string }).updatedAt)
      }
      activeSaves.current--
      if (activeSaves.current === 0 && pendingChanges.current.size === 0) {
        setSaveStatus('saved')
      }
    } catch (err) {
      activeSaves.current--
      setSaveStatus('error')
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [enabled, onUpdatedAt])

  const saveAddItem = useCallback((personId: string, item: { id: string; name: string; price: number; discountPercent: number | null }) => {
    execSave(() => addItemToOrder(orderId, personId, item))
  }, [orderId, execSave])

  const saveRemoveItem = useCallback((personId: string, itemId: string) => {
    // Cancel any pending debounced update for this item
    const key = `update-item-${itemId}`
    const timer = debounceTimers.current.get(key)
    if (timer) {
      clearTimeout(timer)
      debounceTimers.current.delete(key)
      pendingChanges.current.delete(key)
    }
    execSave(() => removeItemFromOrder(orderId, personId, itemId))
  }, [orderId, execSave])

  const executePendingUpdate = useCallback((key: string): Promise<void> => {
    const pending = pendingChanges.current.get(key)
    if (!pending) return Promise.resolve()
    const { personId, itemId, changes } = pending
    pendingChanges.current.delete(key)
    debounceTimers.current.delete(key)
    return execSave(() => updateItemInOrder(orderId, personId, itemId, changes))
  }, [orderId, execSave])

  const debouncedUpdateItem = useCallback((
    personId: string,
    itemId: string,
    changes: ItemChanges,
  ) => {
    if (!enabled) return
    const key = `update-item-${itemId}`

    // Clear existing timer
    const existing = debounceTimers.current.get(key)
    if (existing) clearTimeout(existing)

    // Merge with any existing pending changes for this item
    const prev = pendingChanges.current.get(key)
    const merged: PendingItemUpdate = {
      personId,
      itemId,
      changes: { ...(prev?.changes ?? {}), ...changes },
    }
    pendingChanges.current.set(key, merged)

    const timer = setTimeout(() => {
      executePendingUpdate(key)
    }, 5000)

    debounceTimers.current.set(key, timer)
  }, [enabled, executePendingUpdate])

  const flushUpdateItem = useCallback((itemId: string) => {
    const key = `update-item-${itemId}`
    const existing = debounceTimers.current.get(key)
    if (existing) {
      clearTimeout(existing)
      executePendingUpdate(key)
    }
  }, [executePendingUpdate])

  const flushAll = useCallback(async (): Promise<void> => {
    // Execute all pending debounced saves immediately and await them
    const promises: Promise<void>[] = []
    debounceTimers.current.forEach((timer, key) => {
      clearTimeout(timer)
      promises.push(executePendingUpdate(key))
    })
    debounceTimers.current.clear()
    await Promise.all(promises)
  }, [executePendingUpdate])

  const saveAddPerson = useCallback((personId: string, name: string, userId?: string) => {
    execSave(() => addPersonToOrder(orderId, personId, name, userId))
  }, [orderId, execSave])

  const saveRemovePerson = useCallback((personId: string) => {
    execSave(() => removePersonFromOrder(orderId, personId))
  }, [orderId, execSave])

  const saveUpdatePersonName = useCallback((personId: string, name: string) => {
    execSave(() => updatePersonInOrder(orderId, personId, name))
  }, [orderId, execSave])

  return {
    saveStatus,
    saveAddItem,
    saveRemoveItem,
    debouncedUpdateItem,
    flushUpdateItem,
    flushAll,
    saveAddPerson,
    saveRemovePerson,
    saveUpdatePersonName,
  }
}

import { useState, useCallback } from 'react'
import type { LunchSession, Person, Item, FeeAdjustment } from '../types'

function generateId(): string {
  return crypto.randomUUID()
}

function createInitialSession(): LunchSession {
  return {
    globalDiscountPercent: 0,
    feeAdjustments: [
      { id: generateId(), name: 'Delivery', amount: 0 },
      { id: generateId(), name: 'Delivery coupon', amount: 0 },
      { id: generateId(), name: 'Service', amount: 0 },
    ],
    people: [],
  }
}

export function useLunchSession(initialSession?: LunchSession) {
  const [session, setSession] = useState<LunchSession>(() => initialSession ?? createInitialSession())

  const setGlobalDiscount = useCallback((percent: number) => {
    setSession(prev => ({ ...prev, globalDiscountPercent: percent }))
  }, [])

  const addFeeAdjustment = useCallback((name: string, amount: number) => {
    const fee: FeeAdjustment = { id: generateId(), name, amount }
    setSession(prev => ({
      ...prev,
      feeAdjustments: [...prev.feeAdjustments, fee],
    }))
  }, [])

  const updateFeeAdjustment = useCallback((id: string, updates: Partial<Omit<FeeAdjustment, 'id'>>) => {
    setSession(prev => ({
      ...prev,
      feeAdjustments: prev.feeAdjustments.map(f =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }))
  }, [])

  const removeFeeAdjustment = useCallback((id: string) => {
    setSession(prev => ({
      ...prev,
      feeAdjustments: prev.feeAdjustments.filter(f => f.id !== id),
    }))
  }, [])

  const addPerson = useCallback((name: string, userId?: string, id?: string) => {
    const person: Person = { id: id ?? generateId(), name, userId: userId ?? null, items: [] }
    setSession(prev => ({
      ...prev,
      people: [...prev.people, person],
    }))
  }, [])

  const addGuest = useCallback((options: {
    name: string
    hostUserId: string
    guestId?: string
    newGuest?: { name: string; defaultHostUserId: string }
    id?: string
  }) => {
    const person: Person = {
      id: options.id ?? generateId(),
      name: options.name,
      userId: null,
      guestId: options.guestId ?? null,
      hostUserId: options.hostUserId,
      newGuest: options.newGuest ?? null,
      items: [],
    }
    setSession(prev => ({
      ...prev,
      people: [...prev.people, person],
    }))
  }, [])

  const updatePersonHost = useCallback((personId: string, hostUserId: string) => {
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId && (p.guestId || p.newGuest) ? { ...p, hostUserId } : p
      ),
    }))
  }, [])

  const removePerson = useCallback((personId: string) => {
    setSession(prev => ({
      ...prev,
      people: prev.people
        .filter(p => p.id !== personId)
        .map(p => ({
          ...p,
          items: p.items.map(item => ({
            ...item,
            sharedWith: item.sharedWith.filter(id => id !== personId),
            customShares: item.customShares
              ? (() => {
                  const filtered = Object.fromEntries(Object.entries(item.customShares).filter(([id]) => id !== personId))
                  return Object.keys(filtered).length > 0 ? filtered : null
                })()
              : null,
          })),
        })),
    }))
  }, [])

  const updatePersonName = useCallback((personId: string, name: string) => {
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId ? { ...p, name } : p
      ),
    }))
  }, [])

  const addItem = useCallback((
    personId: string,
    name: string,
    price: number,
    id?: string,
    options?: { isPackaging?: boolean },
  ) => {
    const item: Item = {
      id: id ?? generateId(),
      name,
      price,
      discountPercent: null,
      isPackaging: options?.isPackaging ?? false,
      sharedWith: [],
      customShares: null,
    }
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId ? { ...p, items: [...p.items, item] } : p
      ),
    }))
  }, [])

  const updateItem = useCallback((personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => {
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId
          ? {
              ...p,
              items: p.items.map(i =>
                i.id === itemId ? { ...i, ...updates } : i
              ),
            }
          : p
      ),
    }))
  }, [])

  const removeItem = useCallback((personId: string, itemId: string) => {
    setSession(prev => ({
      ...prev,
      people: prev.people.map(p =>
        p.id === personId
          ? { ...p, items: p.items.filter(i => i.id !== itemId) }
          : p
      ),
    }))
  }, [])

  return {
    session,
    setGlobalDiscount,
    addFeeAdjustment,
    updateFeeAdjustment,
    removeFeeAdjustment,
    addPerson,
    addGuest,
    updatePersonHost,
    removePerson,
    updatePersonName,
    addItem,
    updateItem,
    removeItem,
  }
}

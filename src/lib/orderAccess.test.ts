import { describe, it, expect } from 'vitest'
import { getOrderAccess } from './orderAccess'

// Helper to build test inputs
const makeOrder = (
  overrides: Partial<{
    createdById: string
    status: 'OPEN' | 'CLOSED'
    peopleCount: number
    people: Array<{ userId: string | null }>
  }> = {},
) => ({
  createdById: overrides.createdById ?? 'creator-1',
  status: overrides.status ?? 'OPEN',
  people: overrides.people ?? [],
})

const makeUser = (
  overrides: Partial<{
    id: string
    role: 'ADMIN' | 'USER'
  }> = {},
) => ({
  id: overrides.id ?? 'user-1',
  role: overrides.role ?? 'USER',
})

describe('getOrderAccess', () => {
  describe('creator', () => {
    it('grants full control on open order', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'user-1' }),
        makeUser({ id: 'user-1' }),
      )
      expect(access.isCreator).toBe(true)
      expect(access.canView).toBe(true)
      expect(access.canEdit).toBe(true)
      expect(access.canClose).toBe(true)
      expect(access.canJoin).toBe(false)
      expect(access.canLeave).toBe(false)
      expect(access.isAdminView).toBe(false)
    })

    it('restricts editing on closed order', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'user-1', status: 'CLOSED' }),
        makeUser({ id: 'user-1' }),
      )
      expect(access.canEdit).toBe(false)
      expect(access.canClose).toBe(false)
      expect(access.canReopen).toBe(true)
      expect(access.canView).toBe(true)
    })

    it('allows delete only when order has zero people', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'user-1', people: [] }),
        makeUser({ id: 'user-1' }),
      )
      expect(access.canDelete).toBe(true)

      const accessWithPeople = getOrderAccess(
        makeOrder({ createdById: 'user-1', people: [{ userId: 'other' }] }),
        makeUser({ id: 'user-1' }),
      )
      expect(accessWithPeople.canDelete).toBe(false)
    })
  })

  describe('participant', () => {
    it('can view and edit own items on open order', () => {
      const access = getOrderAccess(
        makeOrder({
          createdById: 'creator-1',
          people: [{ userId: 'user-1' }],
        }),
        makeUser({ id: 'user-1' }),
      )
      expect(access.isParticipant).toBe(true)
      expect(access.canView).toBe(true)
      expect(access.canEditMyItems).toBe(true)
      expect(access.canEdit).toBe(false)
      expect(access.canLeave).toBe(true)
      expect(access.canJoin).toBe(false)
    })

    it('cannot leave closed order', () => {
      const access = getOrderAccess(
        makeOrder({
          createdById: 'creator-1',
          status: 'CLOSED',
          people: [{ userId: 'user-1' }],
        }),
        makeUser({ id: 'user-1' }),
      )
      expect(access.canLeave).toBe(false)
      expect(access.canEditMyItems).toBe(false)
    })
  })

  describe('non-participant', () => {
    it('can view open order as read-only preview', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'creator-1' }),
        makeUser({ id: 'user-1' }),
      )
      expect(access.canView).toBe(true)
      expect(access.canEdit).toBe(false)
      expect(access.canEditMyItems).toBe(false)
      expect(access.canJoin).toBe(true)
    })

    it('cannot view closed order', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'creator-1', status: 'CLOSED' }),
        makeUser({ id: 'user-1' }),
      )
      expect(access.canView).toBe(false)
    })
  })

  describe('admin', () => {
    it('can view and edit any open order', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'creator-1' }),
        makeUser({ id: 'admin-1', role: 'ADMIN' }),
      )
      expect(access.isAdminView).toBe(true)
      expect(access.canView).toBe(true)
      expect(access.canEdit).toBe(true)
      expect(access.canClose).toBe(true)
    })

    it('can view and reopen closed orders', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'creator-1', status: 'CLOSED' }),
        makeUser({ id: 'admin-1', role: 'ADMIN' }),
      )
      expect(access.canView).toBe(true)
      expect(access.canEdit).toBe(false)
      expect(access.canReopen).toBe(true)
      expect(access.isAdminView).toBe(true)
    })

    it('is not admin view when admin is creator', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'admin-1' }),
        makeUser({ id: 'admin-1', role: 'ADMIN' }),
      )
      expect(access.isAdminView).toBe(false)
      expect(access.isCreator).toBe(true)
    })

    it('is not admin view when admin is participant', () => {
      const access = getOrderAccess(
        makeOrder({
          createdById: 'creator-1',
          people: [{ userId: 'admin-1' }],
        }),
        makeUser({ id: 'admin-1', role: 'ADMIN' }),
      )
      expect(access.isAdminView).toBe(false)
      expect(access.isParticipant).toBe(true)
      expect(access.canEdit).toBe(true) // admin privilege still grants canEdit
    })

    it('can delete empty orders they did not create', () => {
      const access = getOrderAccess(
        makeOrder({ createdById: 'creator-1', people: [] }),
        makeUser({ id: 'admin-1', role: 'ADMIN' }),
      )
      expect(access.canDelete).toBe(true)
    })
  })
})

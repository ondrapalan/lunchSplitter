export type OrderAccessInput = {
  createdById: string
  status: 'OPEN' | 'CLOSED'
  people: Array<{ userId: string | null }>
}

export type UserAccessInput = {
  id: string
  role: 'ADMIN' | 'USER'
}

export type OrderAccess = {
  canView: boolean
  canEdit: boolean
  canEditMyItems: boolean
  canJoin: boolean
  canLeave: boolean
  canClose: boolean
  canReopen: boolean
  canDelete: boolean
  isCreator: boolean
  isParticipant: boolean
  isAdminView: boolean
  currentUserPersonId: string | null
}

export function getOrderAccess(
  order: OrderAccessInput,
  user: UserAccessInput,
): OrderAccess {
  const isOpen = order.status === 'OPEN'
  const isAdmin = user.role === 'ADMIN'
  const isCreator = order.createdById === user.id
  const participantPerson = order.people.find((p) => p.userId === user.id)
  const isParticipant = !!participantPerson
  const isAdminView = isAdmin && !isCreator && !isParticipant
  const isEmpty = order.people.length === 0

  return {
    canView: isCreator || isParticipant || isAdmin || isOpen,
    canEdit: (isCreator || isAdmin) && isOpen,
    canEditMyItems: isParticipant && isOpen && !isCreator,
    canJoin: !isCreator && !isParticipant && isOpen,
    canLeave: isParticipant && isOpen && !isCreator,
    canClose: (isCreator || isAdmin) && isOpen,
    canReopen: isCreator || isAdmin,
    canDelete: (isCreator || isAdmin) && isEmpty,
    isCreator,
    isParticipant,
    isAdminView,
    currentUserPersonId: null, // Populated by getOrder() which has full person data with IDs
  }
}

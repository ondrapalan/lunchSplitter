# Open/Closed Orders Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add open/closed lifecycle to orders so open orders are visible to all users, participants can edit their own items, and creators can close/reopen orders.

**Architecture:** Add `OrderStatus` enum to Prisma schema, new server actions for status changes and participant-scoped saves, and update the orders list + detail pages with role-based conditional rendering.

**Tech Stack:** Next.js 15 (App Router, Server Actions), Prisma 6, PostgreSQL, styled-components, react-hook-form, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-17-open-closed-orders-design.md`

---

### Task 1: Add OrderStatus enum and status field to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:38-49`

- [ ] **Step 1: Add the OrderStatus enum and status field**

Add before the `Order` model (after the `Role` enum):

```prisma
enum OrderStatus {
  OPEN
  CLOSED
}
```

Add to the `Order` model, after the `createdById` field:

```prisma
  status            OrderStatus     @default(OPEN)
```

- [ ] **Step 2: Generate and run the migration**

Run:
```bash
npx prisma migrate dev --name add-order-status
```

Expected: Migration creates the `OrderStatus` enum and adds the `status` column with default `OPEN` to the `Order` table. Existing rows get `OPEN`.

- [ ] **Step 3: Verify Prisma client is regenerated**

Run:
```bash
npx prisma generate
```

Expected: No errors. The generated client now includes `OrderStatus` type.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add OrderStatus enum and status field to Order model"
```

---

### Task 2: Add new server actions (closeOrder, reopenOrder, joinOrder, listOpenOrders, saveMyItems)

**Files:**
- Modify: `src/actions/orders.ts`

**Dependencies:** Task 1

- [ ] **Step 1: Add `closeOrder` action**

Add to `src/actions/orders.ts`:

```typescript
export async function closeOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true },
  })
  if (!order || order.createdById !== session.user.id) {
    throw new Error('Unauthorized')
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CLOSED' },
  })

  return { success: true }
}
```

- [ ] **Step 2: Add `reopenOrder` action**

Add to `src/actions/orders.ts`:

```typescript
export async function reopenOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true },
  })
  if (!order || order.createdById !== session.user.id) {
    throw new Error('Unauthorized')
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'OPEN' },
  })

  return { success: true }
}
```

- [ ] **Step 3: Add `joinOrder` action**

Add to `src/actions/orders.ts`:

```typescript
export async function joinOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      createdById: true,
      people: {
        select: { userId: true, sortOrder: true },
      },
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.status !== 'OPEN') throw new Error('This order has been closed')
  if (order.createdById === session.user.id) throw new Error('Creator cannot join their own order')
  if (order.people.some(p => p.userId === session.user.id)) throw new Error('Already a participant')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true },
  })
  if (!user) throw new Error('User not found')

  const maxSortOrder = order.people.reduce((max, p) => Math.max(max, p.sortOrder), -1)

  // Use transaction to ensure both person creation and updatedAt bump are atomic
  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.orderPerson.create({
      data: {
        orderId,
        name: user.displayName,
        userId: session.user.id,
        sortOrder: maxSortOrder + 1,
      },
    })
    // Bump order updatedAt so other clients detect the change
    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    })
    return created
  })

  return { personId: person.id }
}
```

- [ ] **Step 4: Add `listOpenOrders` action**

Add to `src/actions/orders.ts`:

```typescript
export async function listOpenOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await prisma.order.findMany({
    where: { status: 'OPEN' },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      people: { select: { userId: true } },
      _count: { select: { people: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return orders.map(order => ({
    id: order.id,
    restaurantName: order.restaurant.name,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    isCreator: order.createdById === session.user.id,
    creatorName: order.createdBy.displayName,
    peopleCount: order._count.people,
    isParticipant: order.people.some(p => p.userId === session.user.id),
  }))
}
```

- [ ] **Step 5: Add `saveMyItems` action**

Add to `src/actions/orders.ts`. This also needs the `Item` type import — update the existing import line:

```typescript
import type { LunchSession, Item } from '~/features/lunch/types'
```

Then add the action:

```typescript
export async function saveMyItems(
  orderId: string,
  personId: string,
  items: Item[],
  expectedUpdatedAt: string
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      createdById: true,
      updatedAt: true,
      people: {
        where: { id: personId },
        select: { userId: true },
      },
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.status !== 'OPEN') throw new Error('This order has been closed')
  if (order.createdById === session.user.id) {
    throw new Error('Creator should use saveOrder instead')
  }
  if (order.people.length === 0 || order.people[0].userId !== session.user.id) {
    throw new Error('Unauthorized: not your person entry')
  }

  // Optimistic lock: reject if order was modified since client loaded it
  if (order.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new Error('Order was modified — please reload')
  }

  // Validate: participants cannot create shared items or custom shares
  for (const item of items) {
    if (item.sharedWith.length > 0) {
      throw new Error('Participants cannot create shared items')
    }
    if (item.customShares !== null && Object.keys(item.customShares).length > 0) {
      throw new Error('Participants cannot create custom shares')
    }
  }

  await prisma.$transaction([
    // Delete existing items for this person (cascades SharedItemLink, CustomShare)
    prisma.orderItem.deleteMany({ where: { personId } }),
    // Create new items
    ...items.map((item, index) =>
      prisma.orderItem.create({
        data: {
          personId,
          name: item.name,
          price: item.price,
          discountPercent: item.discountPercent,
          sortOrder: index,
        },
      })
    ),
    // Bump order updatedAt
    prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    }),
  ])

  return { success: true }
}
```

- [ ] **Step 6: Verify the file compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat: add closeOrder, reopenOrder, joinOrder, listOpenOrders, saveMyItems server actions"
```

---

### Task 3: Modify existing server actions (listOrders, saveOrder, getOrder)

**Files:**
- Modify: `src/actions/orders.ts`

**Dependencies:** Task 2

- [ ] **Step 1: Update `listOrders` to filter to CLOSED orders only**

In `src/actions/orders.ts`, update the `listOrders` function. Change the `where` clause to add `status: 'CLOSED'`:

```typescript
export async function listOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await prisma.order.findMany({
    where: {
      status: 'CLOSED',
      OR: [
        { createdById: session.user.id },
        { people: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      _count: { select: { people: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return orders.map(order => ({
    id: order.id,
    restaurantName: order.restaurant.name,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    isCreator: order.createdById === session.user.id,
    creatorName: order.createdBy.displayName,
    peopleCount: order._count.people,
  }))
}
```

Key changes: added `status: 'CLOSED'` to where, changed `orderBy` to `updatedAt: 'desc'`.

- [ ] **Step 2: Add optimistic locking to `saveOrder`**

Update `saveOrder` to accept `expectedUpdatedAt` and add creator + status checks. Replace the entire function:

```typescript
export async function saveOrder(orderId: string, lunchSession: LunchSession, expectedUpdatedAt?: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, status: true, updatedAt: true },
  })
  if (!order || order.createdById !== session.user.id) {
    throw new Error('Unauthorized')
  }
  if (order.status === 'CLOSED') {
    throw new Error('Cannot edit a closed order')
  }

  // Optimistic lock (optional for backward compat with new order creation flow)
  if (expectedUpdatedAt && order.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new Error('Order was modified — please reload')
  }

  const input = lunchSessionToPrismaInput(lunchSession)

  await prisma.$transaction([
    prisma.customShare.deleteMany({ where: { item: { person: { orderId } } } }),
    prisma.sharedItemLink.deleteMany({ where: { item: { person: { orderId } } } }),
    prisma.orderItem.deleteMany({ where: { person: { orderId } } }),
    prisma.orderPerson.deleteMany({ where: { orderId } }),
    prisma.feeAdjustment.deleteMany({ where: { orderId } }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        globalDiscountPercent: input.globalDiscountPercent,
        feeAdjustments: input.feeAdjustments,
        people: input.people,
      },
    }),
  ])

  return { success: true }
}
```

Note: `expectedUpdatedAt` is optional so the existing `createOrder` → `saveOrder` flow on the new order page still works without it (new orders have no concurrency risk).

- [ ] **Step 3: Update `getOrder` to return status, isParticipant, currentUserPersonId**

Replace the return block in `getOrder`:

```typescript
export async function getOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      feeAdjustments: { orderBy: { sortOrder: 'asc' } },
      people: {
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: {
              sharedWith: true,
              customShares: true,
            },
          },
        },
      },
    },
  })

  if (!order) return null

  const isCreator = order.createdById === session.user.id
  const currentUserPerson = order.people.find(p => p.userId === session.user.id)
  const isParticipant = !!currentUserPerson

  // Non-participants cannot access closed orders
  if (order.status === 'CLOSED' && !isCreator && !isParticipant) {
    return null
  }

  return {
    restaurantName: order.restaurant.name,
    session: prismaOrderToLunchSession(order),
    isCreator,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    creatorName: order.createdBy.displayName,
    status: order.status as 'OPEN' | 'CLOSED',
    isParticipant,
    currentUserPersonId: currentUserPerson?.id ?? null,
  }
}
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
npx tsc --noEmit
```

Expected: May show errors in pages that consume `getOrder` / `saveOrder` (their signatures changed). This is expected and will be fixed in Tasks 4-5.

- [ ] **Step 5: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat: update listOrders, saveOrder, getOrder for open/closed order support"
```

---

### Task 4: Update Orders List Page

**Files:**
- Modify: `src/app/(app)/orders/page.tsx`

**Dependencies:** Task 3

- [ ] **Step 1: Rewrite the orders list page with two sections**

Replace the entire content of `src/app/(app)/orders/page.tsx`:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { listOrders, listOpenOrders, deleteOrder, closeOrder, reopenOrder, joinOrder } from '~/actions/orders'
import { wasEdited } from '~/features/lunch/utils/formatters'

interface OrderListItem {
  id: string
  restaurantName: string
  createdAt: string
  updatedAt: string
  isCreator: boolean
  creatorName: string
  peopleCount: number
}

interface OpenOrderListItem extends OrderListItem {
  isParticipant: boolean
}

const OrderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const OrderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

const OrderInfo = styled.div`
  flex: 1;
`

const RestaurantName = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.text};
  font-weight: 500;
`

const OrderMeta = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const EmptyState = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: ${({ theme }) => theme.spacing.xl};
`

const CreatorBadge = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 400;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const StatusBadge = styled.span<{ $status: 'OPEN' | 'CLOSED' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  background: ${({ $status, theme }) =>
    $status === 'OPEN' ? 'rgba(129, 199, 132, 0.15)' : 'rgba(144, 164, 174, 0.15)'};
  color: ${({ $status, theme }) =>
    $status === 'OPEN' ? theme.colors.positive : theme.colors.secondary};
`

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`

export default function OrdersPage() {
  const router = useRouter()
  const [openOrders, setOpenOrders] = useState<OpenOrderListItem[]>([])
  const [closedOrders, setClosedOrders] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadOrders = useCallback(async () => {
    const [open, closed] = await Promise.all([listOpenOrders(), listOrders()])
    setOpenOrders(open)
    setClosedOrders(closed)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleDelete = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (!confirm('Delete this order?')) return
    try {
      await deleteOrder(orderId)
      toast.success('Order deleted')
      loadOrders()
    } catch {
      toast.error('Failed to delete order')
    }
  }

  const handleClose = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await closeOrder(orderId)
      toast.success('Order closed')
      loadOrders()
    } catch {
      toast.error('Failed to close order')
    }
  }

  const handleReopen = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await reopenOrder(orderId)
      toast.success('Order reopened')
      loadOrders()
    } catch {
      toast.error('Failed to reopen order')
    }
  }

  const handleJoin = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await joinOrder(orderId)
      toast.success('Joined order!')
      router.push(`/orders/${orderId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join order')
    }
  }

  if (loading) {
    return <SectionTitle>Loading orders...</SectionTitle>
  }

  const isEmpty = openOrders.length === 0 && closedOrders.length === 0

  if (isEmpty) {
    return (
      <div>
        <SectionTitle>Orders</SectionTitle>
        <EmptyState>No orders yet. Create your first order!</EmptyState>
      </div>
    )
  }

  return (
    <div>
      {openOrders.length > 0 && (
        <>
          <SectionTitle>Open Orders</SectionTitle>
          <OrderList>
            {openOrders.map(order => (
              <OrderRow key={order.id} onClick={() => router.push(`/orders/${order.id}`)}>
                <OrderInfo>
                  <RestaurantName>
                    {order.restaurantName}
                    <StatusBadge $status="OPEN">Open</StatusBadge>
                    {!order.isCreator && (
                      <CreatorBadge>by {order.creatorName}</CreatorBadge>
                    )}
                  </RestaurantName>
                  <OrderMeta>
                    {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                  </OrderMeta>
                </OrderInfo>
                <Actions>
                  {order.isCreator && (
                    <Button variant="secondary" size="sm" onClick={e => handleClose(e, order.id)}>
                      Close
                    </Button>
                  )}
                  {!order.isCreator && !order.isParticipant && (
                    <Button variant="primary" size="sm" onClick={e => handleJoin(e, order.id)}>
                      Join
                    </Button>
                  )}
                </Actions>
              </OrderRow>
            ))}
          </OrderList>
        </>
      )}

      {closedOrders.length > 0 && (
        <>
          <SectionTitle>My Orders</SectionTitle>
          <OrderList>
            {closedOrders.map(order => (
              <OrderRow key={order.id} onClick={() => router.push(`/orders/${order.id}`)}>
                <OrderInfo>
                  <RestaurantName>
                    {order.restaurantName}
                    <StatusBadge $status="CLOSED">Closed</StatusBadge>
                    {!order.isCreator && (
                      <CreatorBadge>by {order.creatorName}</CreatorBadge>
                    )}
                  </RestaurantName>
                  <OrderMeta>
                    {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                    {wasEdited(order.createdAt, order.updatedAt) && (
                      <> &middot; Last edited: {new Date(order.updatedAt).toLocaleDateString()}</>
                    )}
                  </OrderMeta>
                </OrderInfo>
                <Actions>
                  {order.isCreator && (
                    <>
                      <Button variant="secondary" size="sm" onClick={e => handleReopen(e, order.id)}>
                        Reopen
                      </Button>
                      <Button variant="danger" size="sm" onClick={e => handleDelete(e, order.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </Actions>
              </OrderRow>
            ))}
          </OrderList>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors in this file. May still see errors in the order detail page (Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/orders/page.tsx
git commit -m "feat: update orders list page with Open Orders and My Orders sections"
```

---

### Task 5: Update PersonCard and PeopleSection with granular edit props

**Files:**
- Modify: `src/features/lunch/components/PersonCard.tsx`
- Modify: `src/features/lunch/components/PeopleSection.tsx`

**Dependencies:** Task 1

- [ ] **Step 1: Update PersonCard props to use granular permissions**

In `src/features/lunch/components/PersonCard.tsx`, replace the `PersonCardProps` interface and update the component. The key change: replace `editable?: boolean` with three granular props.

Replace the interface:

```typescript
interface PersonCardProps {
  person: Person
  allPeople: Person[]
  summary: PersonSummary | undefined
  globalDiscountPercent: number
  itemSuggestions: ItemSuggestion[]
  canEditItems?: boolean
  canEditName?: boolean
  canRemove?: boolean
  hideShareControls?: boolean
  showEditMyItemsButton?: boolean
  onEditMyItems?: () => void
  onRemovePerson: () => void
  onUpdateName: (name: string) => void
  onAddItem: (name: string, price: number) => void
  onUpdateItem: (itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (itemId: string) => void
}
```

Update the function signature:

```typescript
export function PersonCard({
  person,
  allPeople,
  summary,
  globalDiscountPercent,
  itemSuggestions,
  canEditItems = false,
  canEditName = false,
  canRemove = false,
  hideShareControls = false,
  showEditMyItemsButton = false,
  onEditMyItems,
  onRemovePerson,
  onUpdateName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PersonCardProps) {
```

In the `<CardHeader>` JSX, add the "Edit My Items" button next to the card title (after the `RegisteredBadge` span, before the remove button):

```typescript
{showEditMyItemsButton && onEditMyItems && (
  <Button variant="primary" size="sm" onClick={onEditMyItems}>
    Edit My Items
  </Button>
)}
```

Then update all places in the JSX that reference `editable`:

1. Name editing — change `editingName && editable` to `editingName && canEditName` and `editable ? () => setEditingName(true) : undefined` to `canEditName ? () => setEditingName(true) : undefined` and similarly for the cursor style.

2. Remove button — change `{editable && (` to `{canRemove && (` for the `<Button variant="danger" ...>X</Button>`.

3. Item rows — pass `canEditItems` instead of `editable` to `ItemRow`:
```typescript
editable={canEditItems}
```

4. Share button visibility in ItemRow calls — also pass `hideShareControls` down. Update the `ItemRow` rendering to:
```typescript
<ItemRow
  key={item.id}
  item={item}
  globalDiscountPercent={globalDiscountPercent}
  allPeople={allPeople}
  ownerId={person.id}
  editable={canEditItems}
  hideShareControls={hideShareControls}
  onUpdate={updates => onUpdateItem(item.id, updates)}
  onRemove={() => onRemoveItem(item.id)}
/>
```

5. Add item row — change `{editable && (` to `{canEditItems && (` for the `<AddItemRow>` section.

- [ ] **Step 2: Update ItemRow to support hideShareControls**

In `src/features/lunch/components/ItemRow.tsx`, add `hideShareControls?: boolean` to `ItemRowProps` and use it.

Add to the interface:
```typescript
  hideShareControls?: boolean
```

Update the function signature to destructure it:
```typescript
export function ItemRow({ item, globalDiscountPercent, allPeople, ownerId, editable = true, hideShareControls = false, onUpdate, onRemove }: ItemRowProps) {
```

In the JSX, wrap the Share button with the additional condition:
```typescript
{editable && (
  <>
    {!hideShareControls && (
      <Button variant="ghost" size="sm" onClick={() => setShowShareSelector(!showShareSelector)}>
        {showShareSelector ? 'Hide' : 'Share'}
      </Button>
    )}
    <Button variant="danger" size="sm" onClick={onRemove}>X</Button>
  </>
)}
```

- [ ] **Step 3: Update PeopleSection to pass granular props**

In `src/features/lunch/components/PeopleSection.tsx`, update the interface and component:

Replace the `editable?: boolean` prop with granular ones:

```typescript
interface PeopleSectionProps {
  people: Person[]
  summaries: PersonSummary[]
  globalDiscountPercent: number
  registeredUsers?: UserSuggestion[]
  historicalItemSuggestions?: ItemSuggestion[]
  canAddPerson?: boolean
  canEditItems?: boolean
  canEditNames?: boolean
  canRemovePeople?: boolean
  hideShareControls?: boolean
  editablePersonId?: string | null
  showEditMyItemsForPersonId?: string | null
  onEditMyItems?: () => void
  onAddPerson: (name: string, userId?: string) => void
  onRemovePerson: (personId: string) => void
  onUpdatePersonName: (personId: string, name: string) => void
  onAddItem: (personId: string, name: string, price: number) => void
  onUpdateItem: (personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (personId: string, itemId: string) => void
}
```

Update the function:

```typescript
export function PeopleSection({
  people,
  summaries,
  globalDiscountPercent,
  registeredUsers = [],
  historicalItemSuggestions,
  canAddPerson = false,
  canEditItems = false,
  canEditNames = false,
  canRemovePeople = false,
  hideShareControls = false,
  editablePersonId = null,
  showEditMyItemsForPersonId = null,
  onEditMyItems,
  onAddPerson,
  onRemovePerson,
  onUpdatePersonName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PeopleSectionProps) {
```

- `editablePersonId`: when set, only that person's card gets `canEditItems={true}` (participant editing mode)
- `showEditMyItemsForPersonId`: when set, shows "Edit My Items" button on that person's card (participant view mode, before they click edit)

Update the PersonCard rendering:

```typescript
{people.map(person => {
  const isEditablePerson = editablePersonId
    ? person.id === editablePersonId
    : canEditItems

  return (
    <PersonCard
      key={person.id}
      person={person}
      allPeople={people}
      summary={summaries.find(s => s.personId === person.id)}
      globalDiscountPercent={globalDiscountPercent}
      itemSuggestions={itemSuggestions}
      canEditItems={isEditablePerson}
      canEditName={editablePersonId ? false : canEditNames}
      canRemove={editablePersonId ? false : canRemovePeople}
      hideShareControls={hideShareControls || !!editablePersonId}
      showEditMyItemsButton={showEditMyItemsForPersonId === person.id}
      onEditMyItems={onEditMyItems}
      onRemovePerson={() => onRemovePerson(person.id)}
      onUpdateName={name => onUpdatePersonName(person.id, name)}
      onAddItem={(name, price) => onAddItem(person.id, name, price)}
      onUpdateItem={(itemId, updates) => onUpdateItem(person.id, itemId, updates)}
      onRemoveItem={itemId => onRemoveItem(person.id, itemId)}
    />
  )
})}
```

Update the add person section:

```typescript
{canAddPerson && (
  <PersonSuggest
    onAddPerson={onAddPerson}
    users={registeredUsers}
    excludeUserIds={excludeUserIds}
  />
)}
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
npx tsc --noEmit
```

Expected: Errors in pages that still pass the old `editable` prop — these will be fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/features/lunch/components/PersonCard.tsx src/features/lunch/components/PeopleSection.tsx src/features/lunch/components/ItemRow.tsx
git commit -m "feat: replace editable prop with granular canEditItems/canEditName/canRemove permissions"
```

---

### Task 6: Update Order Detail Page for role-based editing

**Files:**
- Modify: `src/app/(app)/orders/[orderId]/page.tsx`

**Dependencies:** Tasks 3, 5

- [ ] **Step 1: Rewrite the order detail page**

Replace the entire content of `src/app/(app)/orders/[orderId]/page.tsx`. This is the most complex change — it handles four view modes (creator-open, participant-open, non-participant-open, closed).

```typescript
'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { useLunchSession } from '~/features/lunch/hooks/useLunchSession'
import { useCalculation } from '~/features/lunch/hooks/useCalculation'
import { OrderSettings } from '~/features/lunch/components/OrderSettings'
import { PeopleSection } from '~/features/lunch/components/PeopleSection'
import { Summary } from '~/features/lunch/components/Summary'

import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { getOrder, saveOrder, getItemsByRestaurant, closeOrder, reopenOrder, joinOrder, saveMyItems } from '~/actions/orders'
import { getRegisteredUsers } from '~/actions/users'
import { wasEdited } from '~/features/lunch/utils/formatters'
import type { UserSuggestion } from '~/features/lunch/components/PersonSuggest'
import type { ItemSuggestion } from '~/features/lunch/components/ItemSuggest'
import type { LunchSession, Item } from '~/features/lunch/types'

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const SaveBar = styled.div`
  display: flex;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

const SaveStatus = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const LastEdited = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const StatusBadge = styled.span<{ $status: 'OPEN' | 'CLOSED' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  margin-left: ${({ theme }) => theme.spacing.sm};
  background: ${({ $status }) =>
    $status === 'OPEN' ? 'rgba(129, 199, 132, 0.15)' : 'rgba(144, 164, 174, 0.15)'};
  color: ${({ $status, theme }) =>
    $status === 'OPEN' ? theme.colors.positive : theme.colors.secondary};
`

const HeaderActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`

interface OrderData {
  restaurantName: string
  session: LunchSession
  isCreator: boolean
  createdAt: string
  updatedAt: string
  creatorName: string
  status: 'OPEN' | 'CLOSED'
  isParticipant: boolean
  currentUserPersonId: string | null
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [registeredUsers, setRegisteredUsers] = useState<UserSuggestion[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingMyItems, setIsEditingMyItems] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const [historicalItems, setHistoricalItems] = useState<ItemSuggestion[]>([])

  const load = useCallback(async () => {
    try {
      const [result, users] = await Promise.all([getOrder(orderId), getRegisteredUsers()])
      setRegisteredUsers(users)
      if (!result) {
        toast.error('Order not found')
        router.push('/orders')
        return
      }
      setOrderData(result)
      getItemsByRestaurant(result.restaurantName).then(setHistoricalItems)
      setLoaded(true)
      // Auto-enter edit mode for empty orders (creator only)
      if (result.session.people.length === 0 && result.isCreator) {
        setIsEditing(true)
      }
    } catch {
      toast.error('Failed to load order')
    }
  }, [orderId, router])

  useEffect(() => {
    load()
  }, [load])

  if (!loaded || !orderData) {
    return <SectionTitle>Loading order...</SectionTitle>
  }

  return (
    <OrderContent
      key={contentKey}
      orderId={orderId}
      orderData={orderData}
      registeredUsers={registeredUsers}
      historicalItemSuggestions={historicalItems}
      isEditing={isEditing}
      isEditingMyItems={isEditingMyItems}
      onEdit={() => setIsEditing(true)}
      onEditMyItems={() => setIsEditingMyItems(true)}
      onCancel={async () => {
        setIsEditing(false)
        setIsEditingMyItems(false)
        await load()
        setContentKey(k => k + 1)
      }}
      onSaved={async () => {
        setIsEditing(false)
        setIsEditingMyItems(false)
        await load()
        setContentKey(k => k + 1)
      }}
      onStatusChange={async () => {
        await load()
        setContentKey(k => k + 1)
      }}
      onJoined={async () => {
        await load()
        setIsEditingMyItems(true)
        setContentKey(k => k + 1)
      }}
    />
  )
}

function OrderContent({
  orderId,
  orderData,
  registeredUsers,
  historicalItemSuggestions,
  isEditing,
  isEditingMyItems,
  onEdit,
  onEditMyItems,
  onCancel,
  onSaved,
  onStatusChange,
  onJoined,
}: {
  orderId: string
  orderData: OrderData
  registeredUsers: UserSuggestion[]
  historicalItemSuggestions: ItemSuggestion[]
  isEditing: boolean
  isEditingMyItems: boolean
  onEdit: () => void
  onEditMyItems: () => void
  onCancel: () => Promise<void>
  onSaved: () => Promise<void>
  onStatusChange: () => Promise<void>
  onJoined: () => Promise<void>
}) {
  const { restaurantName, session: initialSession, isCreator, createdAt, updatedAt, creatorName, status, isParticipant, currentUserPersonId } = orderData
  const [saving, setSaving] = useState(false)

  const {
    session,
    setGlobalDiscount,
    addFeeAdjustment,
    updateFeeAdjustment,
    removeFeeAdjustment,
    addPerson,
    removePerson,
    updatePersonName,
    addItem,
    updateItem,
    removeItem,
  } = useLunchSession(initialSession)

  const { summaries, netFees, feePerPerson, grandTotal } = useCalculation(session)

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveOrder(orderId, session, updatedAt)
      toast.success('Order saved!')
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMyItems = async () => {
    if (!currentUserPersonId) return
    setSaving(true)
    try {
      const myPerson = session.people.find(p => p.id === currentUserPersonId)
      if (!myPerson) throw new Error('Could not find your items')
      await saveMyItems(orderId, currentUserPersonId, myPerson.items, updatedAt)
      toast.success('Items saved!')
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save items')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    try {
      await closeOrder(orderId)
      toast.success('Order closed')
      await onStatusChange()
    } catch {
      toast.error('Failed to close order')
    }
  }

  const handleReopen = async () => {
    try {
      await reopenOrder(orderId)
      toast.success('Order reopened')
      await onStatusChange()
    } catch {
      toast.error('Failed to reopen order')
    }
  }

  const handleJoin = async () => {
    try {
      await joinOrder(orderId)
      toast.success('Joined order!')
      await onJoined()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join order')
    }
  }

  const wasEditedAfterCreation = wasEdited(createdAt, updatedAt)
  const isClosed = status === 'CLOSED'
  const isOpen = status === 'OPEN'

  // Determine what controls to show
  const showCreatorEditButton = isCreator && isOpen && !isEditing
  const showJoinButton = !isCreator && !isParticipant && isOpen
  const showCloseButton = isCreator && isOpen && !isEditing
  const showReopenButton = isCreator && isClosed
  // "Edit My Items" button is shown on the participant's PersonCard, not in the header
  const showEditMyItemsForPersonId = (!isCreator && isParticipant && isOpen && !isEditingMyItems)
    ? currentUserPersonId
    : null

  return (
    <div>
      <Header>
        <div>
          <SectionTitle style={{ marginBottom: 0 }}>
            {restaurantName}
            <StatusBadge $status={status}>{status === 'OPEN' ? 'Open' : 'Closed'}</StatusBadge>
          </SectionTitle>
          {!isCreator && (
            <LastEdited>Created by {creatorName}</LastEdited>
          )}
          {wasEditedAfterCreation && (
            <LastEdited>Last edited: {new Date(updatedAt).toLocaleDateString()}</LastEdited>
          )}
        </div>
        <HeaderActions>
          {showCloseButton && (
            <Button variant="secondary" onClick={handleClose}>Close Order</Button>
          )}
          {showReopenButton && (
            <Button variant="secondary" onClick={handleReopen}>Reopen Order</Button>
          )}
          {showCreatorEditButton && (
            <Button variant="primary" onClick={onEdit}>Edit order details</Button>
          )}
          {showJoinButton && (
            <Button variant="primary" onClick={handleJoin}>Join This Order</Button>
          )}
          {(isEditing || isEditingMyItems) && (
            <SaveStatus>{saving ? 'Saving...' : ''}</SaveStatus>
          )}
        </HeaderActions>
      </Header>

      <OrderSettings
        globalDiscountPercent={session.globalDiscountPercent}
        feeAdjustments={session.feeAdjustments}
        netFees={netFees}
        feePerPerson={feePerPerson}
        peopleCount={session.people.length}
        editable={isEditing}
        onSetGlobalDiscount={setGlobalDiscount}
        onAddFee={addFeeAdjustment}
        onUpdateFee={updateFeeAdjustment}
        onRemoveFee={removeFeeAdjustment}
      />

      <PeopleSection
        people={session.people}
        summaries={summaries}
        globalDiscountPercent={session.globalDiscountPercent}
        registeredUsers={registeredUsers}
        historicalItemSuggestions={historicalItemSuggestions}
        canAddPerson={isEditing}
        canEditItems={isEditing}
        canEditNames={isEditing}
        canRemovePeople={isEditing}
        hideShareControls={isEditingMyItems}
        editablePersonId={isEditingMyItems ? currentUserPersonId : null}
        showEditMyItemsForPersonId={showEditMyItemsForPersonId}
        onEditMyItems={onEditMyItems}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onUpdatePersonName={updatePersonName}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      {isEditing && (
        <SaveBar>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SaveBar>
      )}

      {isEditingMyItems && (
        <SaveBar>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveMyItems} disabled={saving}>
            {saving ? 'Saving...' : 'Save My Items'}
          </Button>
        </SaveBar>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/orders/[orderId]/page.tsx
git commit -m "feat: update order detail page with role-based editing for open/closed orders"
```

---

### Task 7: Update New Order Page for new PeopleSection props

**Files:**
- Modify: `src/app/(app)/orders/new/page.tsx`

**Dependencies:** Task 5

- [ ] **Step 1: Update PeopleSection props in new order page**

In `src/app/(app)/orders/new/page.tsx`, update the `<PeopleSection>` call to use the new granular props (the `editable` prop was removed):

Replace:
```typescript
      <PeopleSection
        people={session.people}
        summaries={summaries}
        globalDiscountPercent={session.globalDiscountPercent}
        registeredUsers={registeredUsers}
        historicalItemSuggestions={historicalItems}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onUpdatePersonName={updatePersonName}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />
```

With:
```typescript
      <PeopleSection
        people={session.people}
        summaries={summaries}
        globalDiscountPercent={session.globalDiscountPercent}
        registeredUsers={registeredUsers}
        historicalItemSuggestions={historicalItems}
        canAddPerson
        canEditItems
        canEditNames
        canRemovePeople
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onUpdatePersonName={updatePersonName}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/orders/new/page.tsx
git commit -m "feat: update new order page to use granular PeopleSection props"
```

---

### Task 8: Full build verification and manual testing

**Files:** None (testing only)

**Dependencies:** Tasks 1-7

- [ ] **Step 1: Run full TypeScript check**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run the dev server**

Run:
```bash
npm run dev
```

Expected: App starts without errors.

- [ ] **Step 3: Manual testing checklist**

Test the following scenarios:

1. **Orders list page**: Should show "Open Orders" and "My Orders" sections
2. **Create new order**: Should default to OPEN, appear in Open Orders
3. **Close order**: Creator clicks "Close" → order moves to My Orders
4. **Reopen order**: Creator clicks "Reopen" → order moves back to Open Orders
5. **Join order**: Non-creator clicks "Join" on open order → added as participant, edit mode for their items
6. **Participant edit**: Participant can edit only their items, not others'
7. **Save my items**: Participant saves → only their items updated
8. **Closed order view**: All users see read-only view, creator sees "Reopen"
9. **Delete order**: Creator can delete both open and closed orders
10. **Non-participant closed access**: Direct URL to closed order → redirects to /orders

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

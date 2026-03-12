# Shared Order Visibility & Read-Only Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see orders they participate in and make all orders open in read-only mode by default, with explicit edit toggling for creators only.

**Architecture:** Extend `listOrders()` with an OR clause to include participated orders. Extend `getOrder()` to return `isCreator`, timestamps, and creator name. Add an `editable` prop to all lunch components to toggle between read-only text and interactive inputs. The order detail page defaults to read-only and uses a key-increment remount for cancel/save.

**Tech Stack:** Next.js, Prisma, React, styled-components, Vitest

---

## Chunk 1: API Layer Changes

### Task 1: Update `getOrder()` server action

**Files:**
- Modify: `src/actions/orders.ts:80-110`

- [ ] **Step 1: Update `getOrder` to include `createdBy` relation and return metadata**

In `src/actions/orders.ts`, update the `getOrder` function to include the `createdBy` relation and return `isCreator`, `createdAt`, `updatedAt`, and `creatorName`:

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

  return {
    restaurantName: order.restaurant.name,
    session: prismaOrderToLunchSession(order),
    isCreator: order.createdById === session.user.id,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    creatorName: order.createdBy.displayName,
  }
}
```

- [ ] **Step 2: Verify the app still compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds (no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat: extend getOrder to return isCreator, timestamps, and creator name"
```

### Task 2: Update `listOrders()` server action

**Files:**
- Modify: `src/actions/orders.ts:112-131`

- [ ] **Step 1: Update `listOrders` to include participated orders and return new fields**

In `src/actions/orders.ts`, update the `listOrders` function. Returns `isCreator` boolean per order (computed server-side) instead of raw `createdById`:

```typescript
export async function listOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await prisma.order.findMany({
    where: {
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
  }))
}
```

- [ ] **Step 2: Verify the app still compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat: extend listOrders to include participated orders and creator info"
```

## Chunk 2: Order List Page

### Task 3: Update the order list page to show creator badges, "last edited", and conditional delete

**Files:**
- Modify: `src/app/(app)/orders/page.tsx`

- [ ] **Step 1: Update the `OrderListItem` interface and add helper**

Add the new fields to the interface and add an `isEdited` helper function:

```typescript
interface OrderListItem {
  id: string
  restaurantName: string
  createdAt: string
  updatedAt: string
  isCreator: boolean
  creatorName: string
  peopleCount: number
}
```

Also create a shared utility in `src/features/lunch/utils/formatters.ts`:

```typescript
export function wasEdited(createdAt: string, updatedAt: string): boolean {
  return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 10_000
}
```

Import it in the page:

```typescript
import { wasEdited } from '~/features/lunch/utils/formatters'
```

- [ ] **Step 2: Update the `OrderRow` rendering**

Update the JSX to show creator badge, conditional "last edited", and conditional delete. The `isCreator` boolean comes from the server action, so no `useSession` needed:

```tsx
{orders.map(order => (
  <OrderRow key={order.id} onClick={() => router.push(`/orders/${order.id}`)}>
    <OrderInfo>
      <RestaurantName>
        {order.restaurantName}
        {!order.isCreator && (
          <CreatorBadge> by {order.creatorName}</CreatorBadge>
        )}
      </RestaurantName>
      <OrderMeta>
        {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
        {wasEdited(order.createdAt, order.updatedAt) && (
          <> &middot; Last edited: {new Date(order.updatedAt).toLocaleDateString()}</>
        )}
      </OrderMeta>
    </OrderInfo>
    {order.isCreator && (
      <Button variant="danger" size="sm" onClick={e => handleDelete(e, order.id)}>
        Delete
      </Button>
    )}
  </OrderRow>
))}
```

- [ ] **Step 4: Add the `CreatorBadge` styled component**

Add after the existing styled components:

```typescript
const CreatorBadge = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 400;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`
```

- [ ] **Step 5: Add a test for `wasEdited` utility**

Add to `src/features/lunch/utils/formatters.test.ts`:

```typescript
describe('wasEdited', () => {
  it('returns false when timestamps are within 10 seconds', () => {
    expect(wasEdited('2026-01-01T00:00:00Z', '2026-01-01T00:00:05Z')).toBe(false)
  })

  it('returns true when timestamps differ by more than 10 seconds', () => {
    expect(wasEdited('2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z')).toBe(true)
  })

  it('returns false when timestamps are identical', () => {
    expect(wasEdited('2026-01-01T12:00:00Z', '2026-01-01T12:00:00Z')).toBe(false)
  })
})
```

Add the import at the top of the test file:

```typescript
import { wasEdited } from './formatters'
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/features/lunch/utils/formatters.test.ts`
Expected: All tests pass

- [ ] **Step 7: Verify the app compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/features/lunch/utils/formatters.ts src/features/lunch/utils/formatters.test.ts src/app/(app)/orders/page.tsx
git commit -m "feat: show creator badges, last edited dates, and conditional delete on order list"
```

## Chunk 3: Component `editable` Prop — Leaf Components

### Task 4: Add `editable` prop to `ItemRow`

**Files:**
- Modify: `src/features/lunch/components/ItemRow.tsx`

- [ ] **Step 1: Add `editable` prop to `ItemRowProps` interface**

```typescript
interface ItemRowProps {
  item: Item
  globalDiscountPercent: number
  allPeople: Person[]
  ownerId: string
  editable?: boolean
  onUpdate: (updates: Partial<Omit<Item, 'id'>>) => void
  onRemove: () => void
}
```

- [ ] **Step 2: Destructure `editable` with default `true` and guard interactive elements**

Update the function signature:

```typescript
export function ItemRow({ item, globalDiscountPercent, allPeople, ownerId, editable = true, onUpdate, onRemove }: ItemRowProps) {
```

Replace the discount badge / edit discount section (the ternary at lines 131-153) with:

```tsx
{editingDiscount && editable ? (
  <NumberInput
    autoFocus
    defaultValue={item.discountPercent ?? ''}
    placeholder="global"
    onBlur={handleDiscountBlur}
    onChange={e => handleDiscountChange(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter') handleDiscountBlur()
      if (e.key === 'Escape') {
        onUpdate({ discountPercent: null })
        setEditingDiscount(false)
      }
    }}
    style={{ width: '60px' }}
    min={0}
    max={100}
  />
) : (
  <DiscountBadge
    $custom={isCustomDiscount}
    onClick={editable ? handleDiscountClick : undefined}
    style={editable ? undefined : { cursor: 'default', pointerEvents: 'none' as const }}
    as={editable ? 'button' : 'span'}
  >
    {isCustomDiscount ? `${effectiveDiscount}%` : `global ${effectiveDiscount}%`}
  </DiscountBadge>
)}
```

Hide the Share and Remove buttons when not editable. Replace lines 154-157:

```tsx
{editable && (
  <>
    <Button variant="ghost" size="sm" onClick={() => setShowShareSelector(!showShareSelector)}>
      {showShareSelector ? 'Hide' : 'Share'}
    </Button>
    <Button variant="danger" size="sm" onClick={onRemove}>X</Button>
  </>
)}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/features/lunch/components/ItemRow.tsx
git commit -m "feat: add editable prop to ItemRow component"
```

### Task 5: Add `editable` prop to `PersonCard`

**Files:**
- Modify: `src/features/lunch/components/PersonCard.tsx`

- [ ] **Step 1: Add `editable` to `PersonCardProps` and destructure it**

```typescript
interface PersonCardProps {
  person: Person
  allPeople: Person[]
  summary: PersonSummary | undefined
  globalDiscountPercent: number
  itemSuggestions: ItemSuggestion[]
  editable?: boolean
  onRemovePerson: () => void
  onUpdateName: (name: string) => void
  onAddItem: (name: string, price: number) => void
  onUpdateItem: (itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (itemId: string) => void
}
```

Destructure with default:

```typescript
export function PersonCard({
  person,
  allPeople,
  summary,
  globalDiscountPercent,
  itemSuggestions,
  editable = true,
  onRemovePerson,
  onUpdateName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PersonCardProps) {
```

- [ ] **Step 2: Guard name editing — suppress click-to-edit when not editable**

Replace the `CardHeader` section (lines 98-122):

```tsx
<CardHeader>
  {editingName && editable ? (
    <Input
      autoFocus
      defaultValue={person.name}
      onBlur={e => {
        onUpdateName(e.target.value)
        setEditingName(false)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          onUpdateName((e.target as HTMLInputElement).value)
          setEditingName(false)
        }
      }}
      style={{ maxWidth: '200px' }}
    />
  ) : (
    <CardTitle
      onClick={editable ? () => setEditingName(true) : undefined}
      style={editable ? { cursor: 'pointer' } : undefined}
    >
      {person.name}
      {person.userId && <RegisteredBadge> (user)</RegisteredBadge>}
    </CardTitle>
  )}
  {editable && (
    <Button variant="danger" size="sm" onClick={onRemovePerson}>X</Button>
  )}
</CardHeader>
```

- [ ] **Step 3: Pass `editable` to `ItemRow` children**

Update the ItemRow rendering (line 125-134):

```tsx
{person.items.map(item => (
  <ItemRow
    key={item.id}
    item={item}
    globalDiscountPercent={globalDiscountPercent}
    allPeople={allPeople}
    ownerId={person.id}
    editable={editable}
    onUpdate={updates => onUpdateItem(item.id, updates)}
    onRemove={() => onRemoveItem(item.id)}
  />
))}
```

- [ ] **Step 4: Hide the "Add Item" row when not editable**

Wrap the `AddItemRow` section (lines 145-164) with:

```tsx
{editable && (
  <AddItemRow>
    <ItemSuggest
      value={newItemName}
      onChange={setNewItemName}
      onSelect={handleSuggestionSelect}
      suggestions={itemSuggestions}
      onKeyDown={handleKeyDown}
      placeholder="Item name"
    />
    <NumberInput
      value={newItemPrice}
      onChange={e => setNewItemPrice(e.target.value)}
      placeholder="Price"
      onKeyDown={handleKeyDown}
      min={0}
    />
    <Button variant="secondary" size="sm" onClick={handleAddItem}>
      + Add
    </Button>
  </AddItemRow>
)}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/features/lunch/components/PersonCard.tsx
git commit -m "feat: add editable prop to PersonCard component"
```

### Task 6: Add `editable` prop to `OrderSettings`

**Files:**
- Modify: `src/features/lunch/components/OrderSettings.tsx`

- [ ] **Step 1: Add `editable` to `OrderSettingsProps` and destructure**

```typescript
interface OrderSettingsProps {
  globalDiscountPercent: number
  feeAdjustments: FeeAdjustment[]
  netFees: number
  feePerPerson: number
  peopleCount: number
  editable?: boolean
  onSetGlobalDiscount: (percent: number) => void
  onAddFee: (name: string, amount: number) => void
  onUpdateFee: (id: string, updates: Partial<Omit<FeeAdjustment, 'id'>>) => void
  onRemoveFee: (id: string) => void
}
```

Destructure with default:

```typescript
export function OrderSettings({
  globalDiscountPercent,
  feeAdjustments,
  netFees,
  feePerPerson,
  peopleCount,
  editable = true,
  onSetGlobalDiscount,
  onAddFee,
  onUpdateFee,
  onRemoveFee,
}: OrderSettingsProps) {
```

- [ ] **Step 2: Replace discount input with read-only text when not editable**

Replace the `SettingsRow` for Global Discount (lines 87-98):

```tsx
<SettingsRow>
  <Label>Global Discount</Label>
  {editable ? (
    <>
      <NumberInput
        value={globalDiscountPercent || ''}
        onChange={e => onSetGlobalDiscount(parseFloat(e.target.value) || 0)}
        placeholder="0"
        min={0}
        max={100}
        style={{ width: '60px' }}
      />
      <span>%</span>
    </>
  ) : (
    <span>{globalDiscountPercent}%</span>
  )}
</SettingsRow>
```

- [ ] **Step 3: Replace fee list with read-only rendering when not editable**

Replace the fee adjustments mapping (lines 104-140):

```tsx
{feeAdjustments.map(fee => (
  <FeeGrid key={fee.id}>
    {editable ? (
      <>
        <Input
          value={fee.name}
          onChange={e => onUpdateFee(fee.id, { name: e.target.value })}
        />
        <NumberInput
          value={fee.amount || ''}
          onChange={e => onUpdateFee(fee.id, { amount: parseFloat(e.target.value) || 0 })}
          style={{ width: '100%' }}
        />
        <CzkLabel>CZK</CzkLabel>
        <Button variant="danger" size="sm" onClick={() => onRemoveFee(fee.id)}>
          X
        </Button>
      </>
    ) : (
      <>
        <span>{fee.name}</span>
        <span style={{ textAlign: 'right' }}>{fee.amount} CZK</span>
        <span />
        <span />
      </>
    )}
  </FeeGrid>
))}

{editable && (
  <FeeGrid>
    <Input
      value={newFeeName}
      onChange={e => setNewFeeName(e.target.value)}
      placeholder="Fee name"
      onKeyDown={handleAddFeeKeyDown}
    />
    <NumberInput
      value={newFeeAmount}
      onChange={e => setNewFeeAmount(e.target.value)}
      placeholder="amount"
      onKeyDown={handleAddFeeKeyDown}
      style={{ width: '100%' }}
    />
    <div />
    <Button variant="secondary" size="sm" onClick={handleAddFee}>
      +
    </Button>
  </FeeGrid>
)}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/features/lunch/components/OrderSettings.tsx
git commit -m "feat: add editable prop to OrderSettings component"
```

### Task 7: Add `editable` prop to `PeopleSection`

**Files:**
- Modify: `src/features/lunch/components/PeopleSection.tsx`

- [ ] **Step 1: Add `editable` to `PeopleSectionProps` and destructure**

```typescript
interface PeopleSectionProps {
  people: Person[]
  summaries: PersonSummary[]
  globalDiscountPercent: number
  registeredUsers?: UserSuggestion[]
  editable?: boolean
  onAddPerson: (name: string, userId?: string) => void
  onRemovePerson: (personId: string) => void
  onUpdatePersonName: (personId: string, name: string) => void
  onAddItem: (personId: string, name: string, price: number) => void
  onUpdateItem: (personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (personId: string, itemId: string) => void
}
```

Destructure with default:

```typescript
export function PeopleSection({
  people,
  summaries,
  globalDiscountPercent,
  registeredUsers = [],
  editable = true,
  onAddPerson,
  onRemovePerson,
  onUpdatePersonName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PeopleSectionProps) {
```

- [ ] **Step 2: Pass `editable` to `PersonCard` and conditionally render `PersonSuggest`**

Pass `editable` to each `PersonCard`:

```tsx
<PersonCard
  key={person.id}
  person={person}
  allPeople={people}
  summary={summaries.find(s => s.personId === person.id)}
  globalDiscountPercent={globalDiscountPercent}
  itemSuggestions={itemSuggestions}
  editable={editable}
  onRemovePerson={() => onRemovePerson(person.id)}
  onUpdateName={name => onUpdatePersonName(person.id, name)}
  onAddItem={(name, price) => onAddItem(person.id, name, price)}
  onUpdateItem={(itemId, updates) => onUpdateItem(person.id, itemId, updates)}
  onRemoveItem={itemId => onRemoveItem(person.id, itemId)}
/>
```

Conditionally render `PersonSuggest`:

```tsx
{editable && (
  <PersonSuggest
    onAddPerson={onAddPerson}
    users={registeredUsers}
    excludeUserIds={excludeUserIds}
  />
)}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/features/lunch/components/PeopleSection.tsx
git commit -m "feat: add editable prop to PeopleSection component"
```

**Note:** `SharedItemRef` is listed in the spec's component change summary, but it is already fully read-only (displays static text only, no interactive elements). No changes needed.

## Chunk 4: Order Detail Page — Read-Only Default + Edit Toggle

### Task 8: Refactor the order detail page with read-only default and edit toggle

**Files:**
- Modify: `src/app/(app)/orders/[orderId]/page.tsx`

- [ ] **Step 1: Add `isEditing` state and `contentKey` for remounting**

Add new imports and state in `EditOrderPage`:

```typescript
import { wasEdited } from '~/features/lunch/utils/formatters'
```

Add new state variables inside `EditOrderPage`:

```typescript
const [isEditing, setIsEditing] = useState(false)
const [contentKey, setContentKey] = useState(0)
const [isCreator, setIsCreator] = useState(false)
const [createdAt, setCreatedAt] = useState('')
const [updatedAt, setUpdatedAt] = useState('')
const [creatorName, setCreatorName] = useState('')
```

- [ ] **Step 2: Extract `load` function from `useEffect` using `useCallback`**

Add `useCallback` to imports. Move the `load` function out of the `useEffect` closure using `useCallback` so it can be reused for cancel/save re-fetch without ESLint `exhaustive-deps` warnings:

```typescript
import { useEffect, useState, use, useCallback } from 'react'
```

```typescript
const load = useCallback(async () => {
  const [result, users] = await Promise.all([getOrder(orderId), getRegisteredUsers()])
  setRegisteredUsers(users)
  if (!result) {
    toast.error('Order not found')
    router.push('/orders')
    return
  }
  setRestaurantName(result.restaurantName)
  setLoadedSession(result.session)
  setIsCreator(result.isCreator)
  setCreatedAt(result.createdAt)
  setUpdatedAt(result.updatedAt)
  setCreatorName(result.creatorName)
  setLoaded(true)
  // Auto-enter edit mode for empty orders
  if (result.session.people.length === 0 && result.isCreator) {
    setIsEditing(true)
  }
}, [orderId, router])

useEffect(() => {
  load()
}, [load])
```

- [ ] **Step 3: Pass new props to content component with re-fetch callbacks**

**Important:** Steps 3 and 4 must be applied together — the build will fail between them since Step 3 passes new props that Step 4 defines.

Update the return JSX. The `onCancel` and `onSaved` callbacks re-fetch from the server via `load()` before remounting via key increment, ensuring the next render uses fresh server data:

```tsx
return (
  <EditOrderContent
    key={contentKey}
    orderId={orderId}
    restaurantName={restaurantName}
    initialSession={loadedSession}
    registeredUsers={registeredUsers}
    isCreator={isCreator}
    isEditing={isEditing}
    createdAt={createdAt}
    updatedAt={updatedAt}
    creatorName={creatorName}
    onEdit={() => setIsEditing(true)}
    onCancel={async () => {
      setIsEditing(false)
      await load()
      setContentKey(k => k + 1)
    }}
    onSaved={async () => {
      setIsEditing(false)
      await load()
      setContentKey(k => k + 1)
    }}
  />
)
```

- [ ] **Step 4: Update `EditOrderContent` to accept new props and implement read-only/edit toggling**

Replace the `EditOrderContent` function signature and body:

```typescript
function EditOrderContent({
  orderId,
  restaurantName,
  initialSession,
  registeredUsers,
  isCreator,
  isEditing,
  createdAt,
  updatedAt,
  creatorName,
  onEdit,
  onCancel,
  onSaved,
}: {
  orderId: string
  restaurantName: string
  initialSession: LunchSession
  registeredUsers: UserSuggestion[]
  isCreator: boolean
  isEditing: boolean
  createdAt: string
  updatedAt: string
  creatorName: string
  onEdit: () => void
  onCancel: () => Promise<void>
  onSaved: () => Promise<void>
}) {
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
      await saveOrder(orderId, session)
      toast.success('Order saved!')
      await onSaved()
    } catch {
      toast.error('Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  const wasEditedAfterCreation = wasEdited(createdAt, updatedAt)

  return (
    <div>
      <Header>
        <div>
          <SectionTitle style={{ marginBottom: 0 }}>{restaurantName}</SectionTitle>
          {wasEditedAfterCreation && (
            <LastEdited>Last edited: {new Date(updatedAt).toLocaleDateString()}</LastEdited>
          )}
        </div>
        {isCreator && !isEditing && (
          <Button variant="primary" onClick={onEdit}>
            Edit order details
          </Button>
        )}
        {isEditing && (
          <SaveStatus>{saving ? 'Saving...' : ''}</SaveStatus>
        )}
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
        editable={isEditing}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onUpdatePersonName={updatePersonName}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      <CopySummary session={session} summaries={summaries} />

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
    </div>
  )
}
```

- [ ] **Step 5: Add the `LastEdited` styled component**

Add after the existing styled components:

```typescript
const LastEdited = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`
```

- [ ] **Step 6: Remove the old `saving` / `setSaving` props from `EditOrderPage`**

Remove the `saving` and `setSaving` state from `EditOrderPage` since they are now managed inside `EditOrderContent`.

- [ ] **Step 7: Verify the app compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 8: Run existing tests to make sure nothing is broken**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 9: Commit**

```bash
git add src/app/(app)/orders/[orderId]/page.tsx
git commit -m "feat: order detail page defaults to read-only with edit toggle for creators"
```

## Chunk 5: Final Verification

### Task 9: Full build and test verification

- [ ] **Step 1: Run full build**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Manual smoke test checklist**

Verify the following manually:
1. Order list shows orders you created AND orders you participate in
2. Orders you created show no "by" badge, orders from others show "by [name]"
3. "Last edited" only appears on orders that were saved after creation
4. Delete button only appears on orders you created
5. Clicking an order opens it in read-only mode (no inputs, no add/remove buttons)
6. Creator sees "Edit order details" button; participant does not
7. Clicking "Edit order details" enables all inputs and shows Save/Cancel bar
8. "Cancel" discards changes and returns to read-only
9. "Save Changes" saves, returns to read-only, and updates "last edited"
10. Newly created orders open in edit mode automatically

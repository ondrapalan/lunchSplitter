export interface FeeAdjustment {
  id: string
  name: string
  amount: number // positive = fee, negative = coupon/discount
}

export interface Item {
  id: string
  name: string
  price: number
  discountPercent: number | null // null = use global discount
  isPackaging: boolean
  sharedWith: string[] // person IDs who also share this item (excludes owner)
  customShares: Record<string, number> | null // null = equal split, or personId -> pre-discount amount
}

export interface Person {
  id: string
  name: string
  userId?: string | null
  guestId?: string | null
  hostUserId?: string | null
  hasDiscord?: boolean
  newGuest?: { name: string; defaultHostUserId: string } | null
  items: Item[]
}

export interface LunchSession {
  globalDiscountPercent: number
  feeAdjustments: FeeAdjustment[]
  people: Person[]
}

export interface PersonSummary {
  personId: string
  name: string
  subtotal: number // raw prices, their share
  afterDiscount: number // after applying discounts
  withFees: number // final amount including fee share
}

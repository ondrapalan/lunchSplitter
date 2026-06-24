import type { FeeAdjustment, LunchSession, Person, PersonSummary } from '../types'

export function calculateNetFees(feeAdjustments: FeeAdjustment[]): number {
  return feeAdjustments.reduce((sum, fee) => sum + fee.amount, 0)
}

export function calculateFeePerPerson(netFees: number, peopleCount: number): number {
  if (peopleCount === 0) return 0
  return netFees / peopleCount
}

function getEffectiveDiscount(itemDiscount: number | null, globalDiscount: number): number {
  return itemDiscount !== null ? itemDiscount : globalDiscount
}

function getSharerCount(item: { sharedWith: string[] }): number {
  return item.sharedWith.length > 0 ? item.sharedWith.length + 1 : 1
}

export function calculatePersonSummaries(session: LunchSession): PersonSummary[] {
  const { globalDiscountPercent, feeAdjustments, people } = session
  const netFees = calculateNetFees(feeAdjustments)
  const feePerPerson = calculateFeePerPerson(netFees, people.length)

  return people.map((person) => {
    let subtotal = 0
    let afterDiscount = 0
    let afterDiscountFood = 0

    // Own items
    for (const item of person.items) {
      const discount = getEffectiveDiscount(item.discountPercent, globalDiscountPercent)
      const sharerCount = getSharerCount(item)
      const rawShare = item.price / sharerCount

      let discounted: number
      if (item.customShares?.[person.id] !== undefined) {
        const customAmount = item.customShares[person.id]
        subtotal += customAmount
        discounted = customAmount * (1 - discount / 100)
      } else {
        subtotal += rawShare
        discounted = rawShare * (1 - discount / 100)
      }
      afterDiscount += discounted
      if (!item.isPackaging) afterDiscountFood += discounted
    }

    // Items shared from other people
    for (const otherPerson of people) {
      if (otherPerson.id === person.id) continue
      for (const item of otherPerson.items) {
        if (!item.sharedWith.includes(person.id)) continue

        const discount = getEffectiveDiscount(item.discountPercent, globalDiscountPercent)
        const sharerCount = getSharerCount(item)

        let discounted: number
        if (item.customShares?.[person.id] !== undefined) {
          const customAmount = item.customShares[person.id]
          subtotal += customAmount
          discounted = customAmount * (1 - discount / 100)
        } else {
          const rawShare = item.price / sharerCount
          subtotal += rawShare
          discounted = rawShare * (1 - discount / 100)
        }
        afterDiscount += discounted
        if (!item.isPackaging) afterDiscountFood += discounted
      }
    }

    return {
      personId: person.id,
      name: person.name,
      subtotal,
      afterDiscount,
      withFees: afterDiscount + feePerPerson,
      withFeesFood: afterDiscountFood + feePerPerson,
    }
  })
}

export function isGuest(person: Person): boolean {
  return !!person.guestId || !!person.newGuest
}

/**
 * Returns the amount a given person is actually on the hook to pay:
 * - Guests owe 0 (their host covers them).
 * - Registered users owe their own share + the shares of every guest hosted by them in this session.
 */
export function calculateChargeableAmount(
  personId: string,
  session: LunchSession,
  summaries?: PersonSummary[],
): number {
  const allSummaries = summaries ?? calculatePersonSummaries(session)
  const person = session.people.find(p => p.id === personId)
  if (!person) return 0
  if (isGuest(person)) return 0

  const ownSummary = allSummaries.find(s => s.personId === personId)
  let total = ownSummary?.withFees ?? 0

  const hostUserId = person.userId
  if (hostUserId) {
    for (const other of session.people) {
      if (!isGuest(other)) continue
      if (other.hostUserId !== hostUserId) continue
      const s = allSummaries.find(ss => ss.personId === other.id)
      total += s?.withFees ?? 0
    }
  }
  return total
}

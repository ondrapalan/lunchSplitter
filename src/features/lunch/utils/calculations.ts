import type { FeeAdjustment, LunchSession, PersonSummary } from '../types'

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

    // Own items
    for (const item of person.items) {
      const discount = getEffectiveDiscount(item.discountPercent, globalDiscountPercent)
      const sharerCount = getSharerCount(item)
      const rawShare = item.price / sharerCount

      if (item.customShares?.[person.id] !== undefined) {
        const customAmount = item.customShares[person.id]
        subtotal += customAmount
        afterDiscount += customAmount * (1 - discount / 100)
      } else {
        subtotal += rawShare
        afterDiscount += rawShare * (1 - discount / 100)
      }
    }

    // Items shared from other people
    for (const otherPerson of people) {
      if (otherPerson.id === person.id) continue
      for (const item of otherPerson.items) {
        if (!item.sharedWith.includes(person.id)) continue

        const discount = getEffectiveDiscount(item.discountPercent, globalDiscountPercent)
        const sharerCount = getSharerCount(item)

        if (item.customShares?.[person.id] !== undefined) {
          const customAmount = item.customShares[person.id]
          subtotal += customAmount
          afterDiscount += customAmount * (1 - discount / 100)
        } else {
          const rawShare = item.price / sharerCount
          subtotal += rawShare
          afterDiscount += rawShare * (1 - discount / 100)
        }
      }
    }

    return {
      personId: person.id,
      name: person.name,
      subtotal,
      afterDiscount,
      withFees: afterDiscount + feePerPerson,
    }
  })
}

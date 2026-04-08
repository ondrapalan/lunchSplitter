'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { prismaOrderToLunchSession } from '~/lib/mappers'
import { calculatePersonSummaries } from '~/features/lunch/utils/calculations'
import type { StatPeriod, SpendingEntry, PersonalStats, FunStat } from '~/features/stats/types'

function getPeriodStart(period: StatPeriod): Date | null {
  if (period === 'all') return null
  const now = new Date()
  switch (period) {
    case 'week': {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
      start.setHours(0, 0, 0, 0)
      return start
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'year':
      return new Date(now.getFullYear(), 0, 1)
  }
}

const fullOrderInclude = {
  restaurant: true,
  feeAdjustments: { orderBy: { sortOrder: 'asc' as const } },
  people: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      user: { select: { displayName: true } },
      items: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          sharedWith: true,
          customShares: true,
        },
      },
    },
  },
}

async function fetchClosedOrders(period: StatPeriod) {
  const periodStart = getPeriodStart(period)
  return prisma.order.findMany({
    where: {
      status: 'CLOSED',
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
    },
    include: fullOrderInclude,
    orderBy: { createdAt: 'desc' },
  })
}

type PersonSpending = {
  name: string
  userId: string | null
  totalSpent: number
  orderCount: number
}

function aggregateSpending(orders: Awaited<ReturnType<typeof fetchClosedOrders>>): SpendingEntry[] {
  const map = new Map<string, PersonSpending>()

  for (const order of orders) {
    const session = prismaOrderToLunchSession(order)
    const summaries = calculatePersonSummaries(session)

    for (const person of order.people) {
      const summary = summaries.find(s => s.personId === person.id)
      if (!summary || summary.withFees <= 0) continue

      const key = person.userId ?? `guest:${person.name}`
      const existing = map.get(key)
      if (existing) {
        existing.totalSpent += summary.withFees
        existing.orderCount += 1
      } else {
        map.set(key, {
          name: person.user?.displayName ?? person.name,
          userId: person.userId,
          totalSpent: summary.withFees,
          orderCount: 1,
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent)
}

export async function getSpendingLeaderboard(period: StatPeriod): Promise<SpendingEntry[]> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await fetchClosedOrders(period)
  return aggregateSpending(orders)
}

export async function getOrderFrequency(period: StatPeriod): Promise<SpendingEntry[]> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await fetchClosedOrders(period)
  const entries = aggregateSpending(orders)
  return entries.sort((a, b) => b.orderCount - a.orderCount)
}

export async function getPersonalStats(): Promise<PersonalStats> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const allOrders = await fetchClosedOrders('all')

  let allTimeSpent = 0
  let weekSpent = 0
  let monthSpent = 0
  let yearSpent = 0
  let totalOrders = 0

  const weekStart = getPeriodStart('week')!
  const monthStart = getPeriodStart('month')!
  const yearStart = getPeriodStart('year')!

  for (const order of allOrders) {
    const lunchSession = prismaOrderToLunchSession(order)
    const summaries = calculatePersonSummaries(lunchSession)
    const myPerson = order.people.find(p => p.userId === session.user.id)
    if (!myPerson) continue

    const mySummary = summaries.find(s => s.personId === myPerson.id)
    if (!mySummary || mySummary.withFees <= 0) continue

    totalOrders += 1
    allTimeSpent += mySummary.withFees

    if (order.createdAt >= weekStart) weekSpent += mySummary.withFees
    if (order.createdAt >= monthStart) monthSpent += mySummary.withFees
    if (order.createdAt >= yearStart) yearSpent += mySummary.withFees
  }

  const avgPerOrder = totalOrders > 0 ? allTimeSpent / totalOrders : 0

  // Calculate orders per month based on first order date
  const firstOrder = allOrders
    .filter(o => o.people.some(p => p.userId === session.user.id))
    .at(-1)
  let ordersPerMonth = 0
  if (firstOrder && totalOrders > 0) {
    const monthsSinceFirst = Math.max(1,
      (Date.now() - firstOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
    ordersPerMonth = totalOrders / monthsSinceFirst
  }

  // Project yearly spending: average monthly spending extrapolated
  const now = new Date()
  const dayOfYear = Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const projectedYearly = dayOfYear > 0 ? (yearSpent / dayOfYear) * 365 : 0

  return {
    weekSpent,
    monthSpent,
    yearSpent,
    allTimeSpent,
    avgPerOrder,
    ordersPerMonth,
    projectedYearly,
    totalOrders,
  }
}

export async function getFunStats(): Promise<FunStat[]> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await fetchClosedOrders('all')
  const stats: FunStat[] = []

  // --- Most Consistent: same (item, restaurant) combo ---
  const itemRestaurantCounts = new Map<string, { count: number; personName: string; itemName: string; restaurantName: string }>()
  for (const order of orders) {
    const restaurantName = order.restaurant.name
    for (const person of order.people) {
      const name = person.user?.displayName ?? person.name
      for (const item of person.items) {
        const key = `${person.userId ?? person.name}|${item.name.toLowerCase()}|${restaurantName.toLowerCase()}`
        const existing = itemRestaurantCounts.get(key)
        if (existing) {
          existing.count += 1
        } else {
          itemRestaurantCounts.set(key, { count: 1, personName: name, itemName: item.name, restaurantName })
        }
      }
    }
  }
  const mostConsistent = Array.from(itemRestaurantCounts.values())
    .filter(e => e.count >= 3)
    .sort((a, b) => b.count - a.count)[0]
  if (mostConsistent) {
    stats.push({
      title: 'The Regular',
      subtitle: `${mostConsistent.itemName} from ${mostConsistent.restaurantName}`,
      personName: mostConsistent.personName,
      value: `${mostConsistent.count}x`,
    })
  }

  // --- Most Experimental: highest unique item count ---
  const personItems = new Map<string, { name: string; uniqueItems: Set<string>; totalItems: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      const key = person.userId ?? `guest:${person.name}`
      const existing = personItems.get(key)
      if (existing) {
        for (const item of person.items) {
          existing.uniqueItems.add(item.name.toLowerCase())
          existing.totalItems += 1
        }
      } else {
        const uniqueItems = new Set(person.items.map(i => i.name.toLowerCase()))
        personItems.set(key, {
          name: person.user?.displayName ?? person.name,
          uniqueItems,
          totalItems: person.items.length,
        })
      }
    }
  }
  const mostExperimental = Array.from(personItems.values())
    .filter(e => e.totalItems >= 5)
    .sort((a, b) => b.uniqueItems.size - a.uniqueItems.size)[0]
  if (mostExperimental) {
    stats.push({
      title: 'The Explorer',
      subtitle: `${mostExperimental.totalItems} items ordered, ${mostExperimental.uniqueItems.size} unique`,
      personName: mostExperimental.personName,
      value: `${mostExperimental.uniqueItems.size} different items`,
    })
  }

  // --- Most Social: most shared item interactions ---
  const shareCount = new Map<string, { name: string; count: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      const key = person.userId ?? `guest:${person.name}`
      for (const item of person.items) {
        if (item.sharedWith.length > 0) {
          const existing = shareCount.get(key)
          if (existing) {
            existing.count += item.sharedWith.length
          } else {
            shareCount.set(key, {
              name: person.user?.displayName ?? person.name,
              count: item.sharedWith.length,
            })
          }
        }
      }
    }
  }
  const mostSocial = Array.from(shareCount.values())
    .sort((a, b) => b.count - a.count)[0]
  if (mostSocial && mostSocial.count >= 2) {
    stats.push({
      title: 'The Sharer',
      subtitle: 'Most items shared with others',
      personName: mostSocial.personName,
      value: `${mostSocial.count} shared`,
    })
  }

  // --- Biggest Single Order ---
  let biggestOrder: { name: string; amount: number; restaurantName: string } | null = null
  for (const order of orders) {
    const lunchSession = prismaOrderToLunchSession(order)
    const summaries = calculatePersonSummaries(lunchSession)
    for (const person of order.people) {
      const summary = summaries.find(s => s.personId === person.id)
      if (summary && (!biggestOrder || summary.withFees > biggestOrder.amount)) {
        biggestOrder = {
          name: person.user?.displayName ?? person.name,
          amount: summary.withFees,
          restaurantName: order.restaurant.name,
        }
      }
    }
  }
  if (biggestOrder) {
    stats.push({
      title: 'Biggest Single Order',
      subtitle: `At ${biggestOrder.restaurantName}`,
      personName: biggestOrder.name,
      value: `${Math.round(biggestOrder.amount)} CZK`,
    })
  }

  // --- Lunch Regular: most order participations ---
  const participationCount = new Map<string, { name: string; count: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      const key = person.userId ?? `guest:${person.name}`
      const existing = participationCount.get(key)
      if (existing) {
        existing.count += 1
      } else {
        participationCount.set(key, {
          name: person.user?.displayName ?? person.name,
          count: 1,
        })
      }
    }
  }
  const lunchRegular = Array.from(participationCount.values())
    .sort((a, b) => b.count - a.count)[0]
  if (lunchRegular && lunchRegular.count >= 2) {
    stats.push({
      title: 'Lunch Regular',
      subtitle: 'Most orders participated in',
      personName: lunchRegular.personName,
      value: `${lunchRegular.count} orders`,
    })
  }

  return stats
}

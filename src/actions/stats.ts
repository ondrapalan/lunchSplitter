'use server'

import { prisma } from '~/lib/prisma'
import { requireSession } from '~/lib/actionAuth'
import { prismaOrderToLunchSession } from '~/lib/mappers'
import { calculatePersonSummaries } from '~/features/lunch/utils/calculations'
import { cached, ORDER_TAGS } from '~/lib/cache'
import { baseOrderInclude } from '~/lib/orderIncludes'
import type { StatPeriod, SpendingEntry, PersonalStats, FunStat, HospitalityEntry, VisitorEntry, SekackaStatsData, SekackaLeaderEntry, SekackaItemBreakdown } from '~/features/stats/types'

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

// Guests are tracked separately — their consumption belongs to their host, so we
// skip them in per-person consumption leaderboards.
function isGuestRow(person: { guestId: string | null }): boolean {
  return person.guestId !== null
}

// Stats leaderboards are intentionally visible to every authenticated user
// (small-team app — colleagues already know each other's spending). Do NOT
// add per-user scoping here without an explicit product change.
const fetchClosedOrdersCached = cached(
  async (period: StatPeriod) => {
    const periodStart = getPeriodStart(period)
    return prisma.order.findMany({
      where: {
        status: 'CLOSED',
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      },
      include: baseOrderInclude,
      orderBy: { createdAt: 'desc' },
    })
  },
  ['closed-orders'],
  { tags: [ORDER_TAGS.closed], revalidate: 60 },
)

// `unstable_cache` round-trips through JSON, which turns Date objects into ISO
// strings. Rehydrate `createdAt` so downstream consumers can treat it as a Date.
async function fetchClosedOrders(period: StatPeriod) {
  const orders = await fetchClosedOrdersCached(period)
  return orders.map(o => ({ ...o, createdAt: new Date(o.createdAt) }))
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
      if (isGuestRow(person)) continue
      const summary = summaries.find(s => s.personId === person.id)
      if (!summary || summary.withFees <= 0) continue

      const chargeable = summary.withFees

      const key = person.userId ?? `legacy:${person.name}`
      const existing = map.get(key)
      if (existing) {
        existing.totalSpent += chargeable
        existing.orderCount += 1
      } else {
        map.set(key, {
          name: person.user?.displayName ?? person.name,
          userId: person.userId,
          totalSpent: chargeable,
          orderCount: 1,
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent)
}

// Internal aggregators skip auth so getStatsBundle can resolve the session
// once and call them in parallel. Public wrappers add the auth check.
async function _spendingLeaderboard(period: StatPeriod): Promise<SpendingEntry[]> {
  const orders = await fetchClosedOrders(period)
  return aggregateSpending(orders)
}

async function _orderFrequency(period: StatPeriod): Promise<SpendingEntry[]> {
  const orders = await fetchClosedOrders(period)
  const entries = aggregateSpending(orders)
  return entries.sort((a, b) => b.orderCount - a.orderCount)
}

export async function getSpendingLeaderboard(period: StatPeriod): Promise<SpendingEntry[]> {
  await requireSession()
  return _spendingLeaderboard(period)
}

export async function getOrderFrequency(period: StatPeriod): Promise<SpendingEntry[]> {
  await requireSession()
  return _orderFrequency(period)
}

async function _personalStats(userId: string): Promise<PersonalStats> {
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
    const myPerson = order.people.find(p => p.userId === userId)
    if (!myPerson) continue

    const mySummary = summaries.find(s => s.personId === myPerson.id)
    if (!mySummary || mySummary.withFees <= 0) continue

    // Include amounts from any guests I hosted in this order — I actually paid for them.
    const hostedTotal = order.people
      .filter(p => isGuestRow(p) && p.hostUserId === userId)
      .reduce((sum, g) => sum + (summaries.find(s => s.personId === g.id)?.withFees ?? 0), 0)
    const chargeable = mySummary.withFees + hostedTotal

    totalOrders += 1
    allTimeSpent += chargeable

    if (order.createdAt >= weekStart) weekSpent += chargeable
    if (order.createdAt >= monthStart) monthSpent += chargeable
    if (order.createdAt >= yearStart) yearSpent += chargeable
  }

  const avgPerOrder = totalOrders > 0 ? allTimeSpent / totalOrders : 0

  // Calculate orders per month based on first order date
  const firstOrder = allOrders
    .filter(o => o.people.some(p => p.userId === userId))
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

export async function getPersonalStats(): Promise<PersonalStats> {
  const session = await requireSession()
  return _personalStats(session.user.id)
}

async function _funStats(): Promise<FunStat[]> {
  const orders = await fetchClosedOrders('all')
  const stats: FunStat[] = []

  // --- Most Consistent: same (item, restaurant) combo ---
  const itemRestaurantCounts = new Map<string, { count: number; personName: string; itemName: string; restaurantName: string }>()
  for (const order of orders) {
    const restaurantName = order.restaurant.name
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      const name = person.user?.displayName ?? person.name
      for (const item of person.items) {
        if (item.isPackaging) continue
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
      description: 'Orders the same thing every time',
      subtitle: `${mostConsistent.itemName} from ${mostConsistent.restaurantName}`,
      personName: mostConsistent.personName,
      value: `${mostConsistent.count}x`,
    })
  }

  // --- Most Experimental: highest unique item count ---
  const personItems = new Map<string, { name: string; uniqueItems: Set<string>; totalItems: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      const key = person.userId ?? `legacy:${person.name}`
      const foodItems = person.items.filter(i => !i.isPackaging)
      const existing = personItems.get(key)
      if (existing) {
        for (const item of foodItems) {
          existing.uniqueItems.add(item.name.toLowerCase())
          existing.totalItems += 1
        }
      } else {
        const uniqueItems = new Set(foodItems.map(i => i.name.toLowerCase()))
        personItems.set(key, {
          name: person.user?.displayName ?? person.name,
          uniqueItems,
          totalItems: foodItems.length,
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
      description: 'Never orders the same thing twice',
      subtitle: `${mostExperimental.totalItems} items ordered, ${mostExperimental.uniqueItems.size} unique`,
      personName: mostExperimental.name,
      value: `${mostExperimental.uniqueItems.size} different items`,
    })
  }

  // --- Most Social: most shared item interactions ---
  const shareCount = new Map<string, { name: string; count: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      const key = person.userId ?? `legacy:${person.name}`
      for (const item of person.items) {
        if (item.isPackaging) continue
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
      description: 'Loves splitting dishes with the group',
      subtitle: 'Most items shared with others',
      personName: mostSocial.name,
      value: `${mostSocial.count} shared`,
    })
  }

  // --- Biggest Single Order ---
  let biggestOrder: { name: string; amount: number; restaurantName: string } | null = null
  for (const order of orders) {
    const lunchSession = prismaOrderToLunchSession(order)
    const summaries = calculatePersonSummaries(lunchSession)
    for (const person of order.people) {
      if (isGuestRow(person)) continue
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
      description: 'Went all out in one sitting',
      subtitle: `At ${biggestOrder.restaurantName}`,
      personName: biggestOrder.name,
      value: `${Math.round(biggestOrder.amount)} CZK`,
    })
  }

  // --- Lunch Regular: most order participations ---
  const participationCount = new Map<string, { name: string; count: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      const key = person.userId ?? `legacy:${person.name}`
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
      description: 'Never misses a group order',
      subtitle: 'Most orders participated in',
      personName: lunchRegular.name,
      value: `${lunchRegular.count} orders`,
    })
  }

  // --- The Bargain Hunter: lowest average price per item ---
  const personAvgPrice = new Map<string, { name: string; totalPrice: number; itemCount: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      const key = person.userId ?? `legacy:${person.name}`
      const foodItems = person.items.filter(i => !i.isPackaging)
      const existing = personAvgPrice.get(key)
      if (existing) {
        for (const item of foodItems) {
          existing.totalPrice += item.price
          existing.itemCount += 1
        }
      } else {
        const totalPrice = foodItems.reduce((sum, i) => sum + i.price, 0)
        personAvgPrice.set(key, {
          name: person.user?.displayName ?? person.name,
          totalPrice,
          itemCount: foodItems.length,
        })
      }
    }
  }
  const bargainHunter = Array.from(personAvgPrice.values())
    .filter(e => e.itemCount >= 3)
    .sort((a, b) => (a.totalPrice / a.itemCount) - (b.totalPrice / b.itemCount))[0]
  if (bargainHunter) {
    stats.push({
      title: 'The Bargain Hunter',
      description: 'Gets the most bang for their buck',
      subtitle: 'Lowest average item price',
      personName: bargainHunter.name,
      value: `${Math.round(bargainHunter.totalPrice / bargainHunter.itemCount)} CZK avg`,
    })
  }

  // --- The Gourmet: highest average price per item ---
  const gourmet = Array.from(personAvgPrice.values())
    .filter(e => e.itemCount >= 3)
    .sort((a, b) => (b.totalPrice / b.itemCount) - (a.totalPrice / a.itemCount))[0]
  if (gourmet && gourmet !== bargainHunter) {
    stats.push({
      title: 'The Gourmet',
      description: 'Only the finest dishes will do',
      subtitle: 'Highest average item price',
      personName: gourmet.name,
      value: `${Math.round(gourmet.totalPrice / gourmet.itemCount)} CZK avg`,
    })
  }

  // --- Favourite Spot: restaurant with the most orders ---
  const restaurantCounts = new Map<string, number>()
  for (const order of orders) {
    const name = order.restaurant.name
    restaurantCounts.set(name, (restaurantCounts.get(name) ?? 0) + 1)
  }
  const favSpot = Array.from(restaurantCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]
  if (favSpot && favSpot[1] >= 2) {
    stats.push({
      title: 'Favourite Spot',
      description: 'The restaurant everyone keeps coming back to',
      subtitle: `${favSpot[1]} orders placed there`,
      personName: favSpot[0],
      value: `${Math.round((favSpot[1] / orders.length) * 100)}% of all orders`,
    })
  }

  // --- The Loyalist: person who orders from the same restaurant the most ---
  const personRestaurant = new Map<string, { name: string; restaurantName: string; count: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      const key = `${person.userId ?? person.name}|${order.restaurant.name}`
      const existing = personRestaurant.get(key)
      if (existing) {
        existing.count += 1
      } else {
        personRestaurant.set(key, {
          name: person.user?.displayName ?? person.name,
          restaurantName: order.restaurant.name,
          count: 1,
        })
      }
    }
  }
  const loyalist = Array.from(personRestaurant.values())
    .filter(e => e.count >= 3)
    .sort((a, b) => b.count - a.count)[0]
  if (loyalist) {
    stats.push({
      title: 'The Loyalist',
      description: 'Has a favourite and sticks to it',
      subtitle: `Always picks ${loyalist.restaurantName}`,
      personName: loyalist.name,
      value: `${loyalist.count} orders`,
    })
  }

  // --- The Feast: person with most items in a single order ---
  let mostItems: { name: string; count: number; restaurantName: string } | null = null
  for (const order of orders) {
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      const foodCount = person.items.filter(i => !i.isPackaging).length
      if (!mostItems || foodCount > mostItems.count) {
        mostItems = {
          name: person.user?.displayName ?? person.name,
          count: foodCount,
          restaurantName: order.restaurant.name,
        }
      }
    }
  }
  if (mostItems && mostItems.count >= 3) {
    stats.push({
      title: 'The Feast',
      description: 'Why pick one when you can have them all?',
      subtitle: `${mostItems.count} items in one order at ${mostItems.restaurantName}`,
      personName: mostItems.name,
      value: `${mostItems.count} items`,
    })
  }

  // --- Early Bird: person who creates the most orders ---
  const creatorCount = new Map<string, { name: string; count: number }>()
  for (const order of orders) {
    const creatorPerson = order.people.find(p => p.userId === order.createdById)
    if (!creatorPerson) continue
    const key = order.createdById
    const existing = creatorCount.get(key)
    if (existing) {
      existing.count += 1
    } else {
      creatorCount.set(key, {
        name: creatorPerson.user?.displayName ?? creatorPerson.name,
        count: 1,
      })
    }
  }
  const earlyBird = Array.from(creatorCount.values())
    .sort((a, b) => b.count - a.count)[0]
  if (earlyBird && earlyBird.count >= 2) {
    stats.push({
      title: 'The Organizer',
      description: 'The one who gets the lunch ball rolling',
      subtitle: 'Creates the most lunch orders',
      personName: earlyBird.name,
      value: `${earlyBird.count} orders started`,
    })
  }

  // --- Most Popular Item: the single item name ordered the most ---
  const itemPopularity = new Map<string, number>()
  for (const order of orders) {
    for (const person of order.people) {
      if (isGuestRow(person)) continue
      for (const item of person.items) {
        if (item.isPackaging) continue
        const key = item.name.toLowerCase()
        itemPopularity.set(key, (itemPopularity.get(key) ?? 0) + 1)
      }
    }
  }
  const popularItem = Array.from(itemPopularity.entries())
    .sort((a, b) => b[1] - a[1])[0]
  if (popularItem && popularItem[1] >= 3) {
    // Capitalize first letter
    const displayName = popularItem[0].charAt(0).toUpperCase() + popularItem[0].slice(1)
    stats.push({
      title: 'Fan Favourite',
      description: 'The dish everyone keeps ordering',
      subtitle: `Ordered ${popularItem[1]} times across all lunches`,
      personName: displayName,
      value: `${popularItem[1]}x ordered`,
    })
  }

  // --- The Host: most guests hosted ---
  const hostCount = new Map<string, { name: string; guests: Set<string>; lunches: number }>()
  for (const order of orders) {
    for (const person of order.people) {
      if (!isGuestRow(person) || !person.hostUserId) continue
      const host = order.people.find(p => p.userId === person.hostUserId)
      const hostName = host?.user?.displayName ?? host?.name ?? 'Unknown'
      const entry = hostCount.get(person.hostUserId)
      if (entry) {
        entry.lunches += 1
        if (person.guestId) entry.guests.add(person.guestId)
      } else {
        hostCount.set(person.hostUserId, {
          name: hostName,
          guests: new Set(person.guestId ? [person.guestId] : []),
          lunches: 1,
        })
      }
    }
  }
  const topHost = Array.from(hostCount.values()).sort((a, b) => b.lunches - a.lunches)[0]
  if (topHost) {
    stats.push({
      title: 'The Host',
      description: 'Picks up the tab for visitors',
      subtitle: `Hosted ${topHost.guests.size} different guest${topHost.guests.size === 1 ? '' : 's'}`,
      personName: topHost.name,
      value: `${topHost.lunches} guest lunch${topHost.lunches === 1 ? '' : 'es'}`,
    })
  }

  return stats
}

export async function getFunStats(): Promise<FunStat[]> {
  await requireSession()
  return _funStats()
}

async function _hospitalityLeaderboard(period: StatPeriod): Promise<HospitalityEntry[]> {
  const orders = await fetchClosedOrders(period)
  const map = new Map<string, HospitalityEntry & { guests: Set<string> }>()

  for (const order of orders) {
    const lunchSession = prismaOrderToLunchSession(order)
    const summaries = calculatePersonSummaries(lunchSession)
    for (const person of order.people) {
      if (!isGuestRow(person) || !person.hostUserId) continue
      const host = order.people.find(p => p.userId === person.hostUserId)
      const hostName = host?.user?.displayName ?? host?.name ?? 'Unknown'
      const covered = summaries.find(s => s.personId === person.id)?.withFees ?? 0
      const existing = map.get(person.hostUserId)
      if (existing) {
        existing.guestLunchCount += 1
        existing.totalCovered += covered
        if (person.guestId) existing.guests.add(person.guestId)
      } else {
        map.set(person.hostUserId, {
          hostUserId: person.hostUserId,
          hostName,
          guestLunchCount: 1,
          distinctGuestCount: 0,
          totalCovered: covered,
          guests: new Set(person.guestId ? [person.guestId] : []),
        })
      }
    }
  }

  return Array.from(map.values())
    .map(e => ({
      hostUserId: e.hostUserId,
      hostName: e.hostName,
      guestLunchCount: e.guestLunchCount,
      distinctGuestCount: e.guests.size,
      totalCovered: e.totalCovered,
    }))
    .sort((a, b) => b.guestLunchCount - a.guestLunchCount)
}

export async function getHospitalityLeaderboard(period: StatPeriod): Promise<HospitalityEntry[]> {
  await requireSession()
  return _hospitalityLeaderboard(period)
}

const getVisitorsCached = cached(
  async (): Promise<VisitorEntry[]> => {
    const guests = await prisma.guest.findMany({
      select: {
        id: true,
        name: true,
        defaultHostUserId: true,
        defaultHost: { select: { displayName: true } },
        orderPersons: {
          select: {
            order: { select: { createdAt: true, status: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return guests.map(g => {
      const closedVisits = g.orderPersons.filter(op => op.order.status === 'CLOSED')
      const lastVisit = closedVisits.reduce<Date | null>((latest, op) => {
        const d = op.order.createdAt
        return !latest || d > latest ? d : latest
      }, null)
      return {
        guestId: g.id,
        name: g.name,
        defaultHostUserId: g.defaultHostUserId,
        defaultHostName: g.defaultHost.displayName,
        visitCount: closedVisits.length,
        lastVisit: lastVisit?.toISOString() ?? null,
      }
    })
  },
  ['visitors'],
  { tags: [ORDER_TAGS.guests, ORDER_TAGS.closed], revalidate: 60 },
)

export async function getVisitors(): Promise<VisitorEntry[]> {
  await requireSession()
  return getVisitorsCached()
}

const fetchSekackaOrders = cached(
  async (period: StatPeriod) => {
    const periodStart = getPeriodStart(period)
    return prisma.order.findMany({
      where: {
        type: 'SEKACKA',
        status: 'CLOSED',
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        people: {
          include: {
            user: { select: { displayName: true } },
            items: { select: { name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },
  ['sekacka-orders'],
  { tags: [ORDER_TAGS.closed], revalidate: 60 },
)

/**
 * Sekačka-specific stats: how many ran, how much was spent in total,
 * who ate the most portions, who brought the most sekaná, and how the
 * item breakdown looks across all closed Sekačkas.
 */
async function _sekackaStats(period: StatPeriod): Promise<SekackaStatsData> {
  const orders = await fetchSekackaOrders(period)

  let totalSpent = 0
  let totalParticipants = 0

  const eaters = new Map<string, SekackaLeaderEntry>()
  const providers = new Map<string, SekackaLeaderEntry>()
  const items = new Map<string, SekackaItemBreakdown>()

  for (const order of orders) {
    const orderItems = order.people.flatMap(p => p.items)
    const orderTotal = orderItems.reduce((sum, it) => sum + it.price, 0)
    const participants = order.people.length
    if (participants === 0) continue

    totalSpent += orderTotal
    totalParticipants += participants
    const perPerson = orderTotal / participants

    // Eaters — every participant (creator included) eats one portion.
    for (const person of order.people) {
      if (!person.userId) continue
      const key = person.userId
      const existing = eaters.get(key)
      const name = person.user?.displayName ?? person.name
      if (existing) {
        existing.count += 1
        existing.totalKc += perPerson
      } else {
        eaters.set(key, { userId: key, name, count: 1, totalKc: perPerson })
      }
    }

    // Providers — only the creator (order.createdById).
    const providerKey = order.createdById
    const providerName = order.createdBy.displayName
    const existingProvider = providers.get(providerKey)
    if (existingProvider) {
      existingProvider.count += 1
      existingProvider.totalKc += orderTotal
    } else {
      providers.set(providerKey, {
        userId: providerKey,
        name: providerName,
        count: 1,
        totalKc: orderTotal,
      })
    }

    // Item breakdown — aggregate by lower-cased name.
    for (const it of orderItems) {
      const key = it.name.trim().toLowerCase()
      const existing = items.get(key)
      if (existing) {
        existing.occurrences += 1
        existing.totalKc += it.price
      } else {
        items.set(key, { name: it.name.trim(), occurrences: 1, totalKc: it.price })
      }
    }
  }

  const totalCount = orders.length
  const avgParticipants = totalCount > 0 ? totalParticipants / totalCount : 0
  const avgPerPortion = totalParticipants > 0 ? totalSpent / totalParticipants : 0

  return {
    summary: {
      totalCount,
      totalSpent,
      avgParticipants,
      avgPerPortion,
    },
    topEaters: Array.from(eaters.values()).sort((a, b) => b.count - a.count || b.totalKc - a.totalKc),
    topProviders: Array.from(providers.values()).sort((a, b) => b.count - a.count || b.totalKc - a.totalKc),
    items: Array.from(items.values()).sort((a, b) => b.totalKc - a.totalKc),
  }
}

export async function getSekackaStats(period: StatPeriod): Promise<SekackaStatsData> {
  await requireSession()
  return _sekackaStats(period)
}

export type StatsBundle = {
  spending: SpendingEntry[]
  frequency: SpendingEntry[]
  hospitality: HospitalityEntry[]
  sekacka: SekackaStatsData
  personal: PersonalStats
  fun: FunStat[]
  visitors: VisitorEntry[]
}

/**
 * Fetch every /stats card in a single server round-trip. The underlying
 * Prisma queries (fetchClosedOrders / fetchSekackaOrders / getVisitors) are
 * each wrapped in unstable_cache, so concurrent aggregations share DB scans
 * and repeat visits within the TTL hit cache entirely.
 */
export async function getStatsBundle(period: StatPeriod): Promise<StatsBundle> {
  const session = await requireSession()

  // Inner aggregators are auth-free so the bundle resolves the session once
  // and shares it across all 7 parallel computations.
  const [spending, frequency, hospitality, sekacka, personal, fun, visitors] = await Promise.all([
    _spendingLeaderboard(period),
    _orderFrequency(period),
    _hospitalityLeaderboard(period),
    _sekackaStats(period),
    _personalStats(session.user.id),
    _funStats(),
    getVisitorsCached(),
  ])

  return { spending, frequency, hospitality, sekacka, personal, fun, visitors }
}

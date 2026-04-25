'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'

export interface ItemNameUsage {
  name: string
  count: number
  avgPrice: number
  packagingCount: number
  allPackaging: boolean
}

// Bound on how many distinct (name, isPackaging) groups we pull back from Postgres.
// Even at 5000 unique item names, this remains a small payload — well below
// what the previous unbounded `findMany` could pull on a busy table.
const ITEM_NAME_GROUP_LIMIT = 5000

export async function listItemNameUsage(): Promise<ItemNameUsage[]> {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Admin only')
  }

  // Push count + avg(price) into Postgres. groupBy is case-sensitive, so we
  // still need a tiny JS pass to merge case-equivalent names (e.g. "Pizza"
  // and "pizza"). Reconstruct totalPrice = avg * count so the merge preserves
  // a correct weighted average across case variants.
  const grouped = await prisma.orderItem.groupBy({
    by: ['name', 'isPackaging'],
    _count: { _all: true },
    _avg: { price: true },
    orderBy: { _count: { name: 'desc' } },
    take: ITEM_NAME_GROUP_LIMIT,
  })

  const map = new Map<string, { displayName: string; count: number; totalPrice: number; packagingCount: number }>()
  for (const row of grouped) {
    const trimmed = row.name.trim()
    const key = trimmed.toLowerCase()
    if (!key) continue
    const groupCount = row._count._all
    const groupTotal = (row._avg.price ?? 0) * groupCount
    const entry = map.get(key)
    if (entry) {
      entry.count += groupCount
      entry.totalPrice += groupTotal
      if (row.isPackaging) entry.packagingCount += groupCount
    } else {
      map.set(key, {
        displayName: trimmed,
        count: groupCount,
        totalPrice: groupTotal,
        packagingCount: row.isPackaging ? groupCount : 0,
      })
    }
  }

  return [...map.values()]
    .map(e => ({
      name: e.displayName,
      count: e.count,
      avgPrice: e.totalPrice / e.count,
      packagingCount: e.packagingCount,
      allPackaging: e.packagingCount === e.count,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function bulkMarkPackaging(names: string[], isPackaging: boolean) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Admin only')
  }

  const trimmed = names.map(n => n.trim()).filter(Boolean)
  if (trimmed.length === 0) return { updated: 0 }

  // Postgres collation makes plain `in` case-sensitive; build an OR of case-insensitive equals instead.
  const result = await prisma.orderItem.updateMany({
    where: {
      OR: trimmed.map(n => ({ name: { equals: n, mode: 'insensitive' as const } })),
    },
    data: { isPackaging },
  })

  return { updated: result.count }
}

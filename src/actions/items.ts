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

export async function listItemNameUsage(): Promise<ItemNameUsage[]> {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Admin only')
  }

  const rows = await prisma.orderItem.findMany({
    select: { name: true, price: true, isPackaging: true },
  })

  const map = new Map<string, { displayName: string; count: number; totalPrice: number; packagingCount: number }>()
  for (const row of rows) {
    const key = row.name.trim().toLowerCase()
    if (!key) continue
    const entry = map.get(key)
    if (entry) {
      entry.count += 1
      entry.totalPrice += row.price
      if (row.isPackaging) entry.packagingCount += 1
    } else {
      map.set(key, {
        displayName: row.name.trim(),
        count: 1,
        totalPrice: row.price,
        packagingCount: row.isPackaging ? 1 : 0,
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

export type StatPeriod = 'week' | 'month' | 'year' | 'all'

export interface SpendingEntry {
  name: string
  userId: string | null
  totalSpent: number
  orderCount: number
}

export interface PersonalStats {
  weekSpent: number
  monthSpent: number
  yearSpent: number
  allTimeSpent: number
  avgPerOrder: number
  ordersPerMonth: number
  projectedYearly: number
  totalOrders: number
}

export interface FunStat {
  title: string
  description: string
  subtitle: string
  personName: string
  value: string
}

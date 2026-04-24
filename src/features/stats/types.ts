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

export interface HospitalityEntry {
  hostUserId: string
  hostName: string
  guestLunchCount: number
  distinctGuestCount: number
  totalCovered: number
}

export interface VisitorEntry {
  guestId: string
  name: string
  defaultHostUserId: string
  defaultHostName: string
  visitCount: number
  lastVisit: string | null
}

export interface SekackaSummary {
  totalCount: number
  totalSpent: number
  avgParticipants: number
  avgPerPortion: number
}

export interface SekackaLeaderEntry {
  userId: string | null
  name: string
  count: number
  totalKc: number
}

export interface SekackaItemBreakdown {
  name: string
  occurrences: number
  totalKc: number
}

export interface SekackaStatsData {
  summary: SekackaSummary
  topEaters: SekackaLeaderEntry[]
  topProviders: SekackaLeaderEntry[]
  items: SekackaItemBreakdown[]
}

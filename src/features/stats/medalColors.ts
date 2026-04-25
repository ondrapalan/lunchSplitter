// Shared medal-color tuple used by every leaderboard rank cell.
// Values are absolute hex (not theme tokens) because gold/silver/bronze
// should look the same in light and dark mode.
export const MEDAL_COLORS = {
  gold: '#D4A017',
  silver: '#8A8A8A',
  bronze: '#CD7F32',
} as const

/** Returns the medal color for a 1-indexed rank, or null for ranks 4+. */
export function medalColorForRank(rank: number): string | null {
  if (rank === 1) return MEDAL_COLORS.gold
  if (rank === 2) return MEDAL_COLORS.silver
  if (rank === 3) return MEDAL_COLORS.bronze
  return null
}

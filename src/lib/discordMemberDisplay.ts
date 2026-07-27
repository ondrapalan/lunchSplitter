import type { DiscordGuildMember } from '~/lib/discord'

export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Nothing is auto-matched, so this label is the only thing identifying a person
 * in the dropdown — it shows every name they might be known by.
 */
export function memberLabel(member: DiscordGuildMember): string {
  const names: string[] = []
  for (const name of [member.nick, member.globalName]) {
    if (!name) continue
    if (names.some(existing => normalizeName(existing) === normalizeName(name))) continue
    names.push(name)
  }
  return [...names, `@${member.username}`].join(' · ')
}

export function sortMembersForDisplay(members: DiscordGuildMember[]): DiscordGuildMember[] {
  return [...members].sort((a, b) => memberLabel(a).localeCompare(memberLabel(b), 'cs'))
}

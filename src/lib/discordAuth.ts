import { prisma } from '~/lib/prisma'

export type DiscordAdminCheck =
  | { ok: true }
  | { ok: false; reason: 'no-identity' | 'not-found' | 'not-admin' }

export function evaluateDiscordAdmin(
  discordId: string | null | undefined,
  user: { role: string } | null,
): DiscordAdminCheck {
  if (!discordId) return { ok: false, reason: 'no-identity' }
  if (!user) return { ok: false, reason: 'not-found' }
  if (user.role !== 'ADMIN') return { ok: false, reason: 'not-admin' }
  return { ok: true }
}

export async function requireDiscordAdmin(
  discordId: string | null | undefined,
): Promise<DiscordAdminCheck> {
  const user = discordId
    ? await prisma.user.findUnique({
        where: { discordId },
        select: { role: true },
      })
    : null
  return evaluateDiscordAdmin(discordId, user)
}

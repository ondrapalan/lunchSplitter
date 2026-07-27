'use server'

import { requireAdmin } from '~/lib/actionAuth'
import { prisma } from '~/lib/prisma'
import {
  DiscordReadError,
  isDiscordConfigured,
  listBotGuilds,
  listGuildMembers,
  type DiscordGuildMember,
} from '~/lib/discord'

/**
 * Guild members nobody is linked to yet. The same list is both the pairing
 * dropdown and the "still not connected to anything" roster, so it shrinks as
 * pairs are made.
 */
export async function listUnlinkedGuildMembers(): Promise<
  { members: DiscordGuildMember[] } | { error: string }
> {
  await requireAdmin()

  if (!isDiscordConfigured()) {
    return { error: 'Discord bot is not configured — DISCORD_BOT_TOKEN is missing.' }
  }

  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) {
    return { error: await missingGuildIdMessage() }
  }

  try {
    const [members, linkedUsers] = await Promise.all([
      listGuildMembers(guildId),
      prisma.user.findMany({
        where: { discordId: { not: null } },
        select: { discordId: true },
      }),
    ])

    const taken = new Set(
      linkedUsers.map(user => user.discordId).filter((id): id is string => id !== null),
    )
    return { members: members.filter(member => !taken.has(member.discordId)) }
  } catch (err) {
    if (err instanceof DiscordReadError && err.status === 403) {
      return {
        error:
          'Discord refused the member list (403). Enable SERVER MEMBERS INTENT for the bot in the '
          + 'Developer Portal under Bot → Privileged Gateway Intents.',
      }
    }
    throw err
  }
}

async function missingGuildIdMessage(): Promise<string> {
  try {
    const guilds = await listBotGuilds()
    if (guilds.length === 0) {
      return 'DISCORD_GUILD_ID is not set, and the bot is not a member of any server.'
    }
    const options = guilds.map(guild => `${guild.id} (${guild.name})`).join(', ')
    return `DISCORD_GUILD_ID is not set. The bot is a member of: ${options}.`
  } catch {
    return 'DISCORD_GUILD_ID is not set.'
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DiscordGuildMember } from '~/lib/discord'

const mocks = vi.hoisted(() => ({
  isDiscordConfigured: vi.fn<() => boolean>(),
  listGuildMembers: vi.fn<(guildId: string) => Promise<DiscordGuildMember[]>>(),
  listBotGuilds: vi.fn<() => Promise<{ id: string; name: string }[]>>(),
  findMany: vi.fn<(args: unknown) => Promise<{ discordId: string | null }[]>>(),
}))

vi.mock('~/lib/actionAuth', () => ({ requireAdmin: vi.fn().mockResolvedValue({}) }))

vi.mock('~/lib/prisma', () => ({ prisma: { user: { findMany: mocks.findMany } } }))

vi.mock('~/lib/discord', async importOriginal => {
  const actual = await importOriginal<typeof import('~/lib/discord')>()
  return {
    DiscordReadError: actual.DiscordReadError,
    isDiscordConfigured: mocks.isDiscordConfigured,
    listGuildMembers: mocks.listGuildMembers,
    listBotGuilds: mocks.listBotGuilds,
  }
})

import { listUnlinkedGuildMembers } from '~/actions/discordMembers'
import { DiscordReadError } from '~/lib/discord'

function member(discordId: string, username: string): DiscordGuildMember {
  return { discordId, username, globalName: null, nick: null }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isDiscordConfigured.mockReturnValue(true)
  vi.stubEnv('DISCORD_GUILD_ID', 'guild-1')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('listUnlinkedGuildMembers', () => {
  it('drops members already linked to a user', async () => {
    mocks.listGuildMembers.mockResolvedValue([member('1', 'alice'), member('2', 'bob')])
    mocks.findMany.mockResolvedValue([{ discordId: '1' }])

    const result = await listUnlinkedGuildMembers()

    expect(result).toEqual({ members: [member('2', 'bob')] })
  })

  it('tolerates a user row with a null Discord ID', async () => {
    mocks.listGuildMembers.mockResolvedValue([member('1', 'alice')])
    mocks.findMany.mockResolvedValue([{ discordId: null }])

    const result = await listUnlinkedGuildMembers()

    expect(result).toEqual({ members: [member('1', 'alice')] })
  })

  it('reports a missing bot token without calling Discord', async () => {
    mocks.isDiscordConfigured.mockReturnValue(false)

    const result = await listUnlinkedGuildMembers()

    expect(result).toEqual({ error: expect.stringContaining('DISCORD_BOT_TOKEN') })
    expect(mocks.listGuildMembers).not.toHaveBeenCalled()
  })

  it('lists the guilds the bot is in when DISCORD_GUILD_ID is missing', async () => {
    vi.stubEnv('DISCORD_GUILD_ID', '')
    mocks.listBotGuilds.mockResolvedValue([{ id: '694149319342686248', name: 'INDIGO' }])

    const result = await listUnlinkedGuildMembers()

    expect(result).toEqual({ error: expect.stringContaining('694149319342686248 (INDIGO)') })
  })

  it('still reports a missing DISCORD_GUILD_ID when the guild lookup itself fails', async () => {
    vi.stubEnv('DISCORD_GUILD_ID', '')
    mocks.listBotGuilds.mockRejectedValue(new DiscordReadError(401, 'Unauthorized'))

    const result = await listUnlinkedGuildMembers()

    expect(result).toEqual({ error: 'DISCORD_GUILD_ID is not set.' })
  })

  it('translates a 403 into the privileged intent instruction', async () => {
    mocks.listGuildMembers.mockRejectedValue(new DiscordReadError(403, 'Missing Access'))
    mocks.findMany.mockResolvedValue([])

    const result = await listUnlinkedGuildMembers()

    expect(result).toEqual({ error: expect.stringContaining('SERVER MEMBERS INTENT') })
  })

  it('rethrows failures it cannot explain', async () => {
    mocks.listGuildMembers.mockRejectedValue(new DiscordReadError(500, 'Internal Server Error'))
    mocks.findMany.mockResolvedValue([])

    await expect(listUnlinkedGuildMembers()).rejects.toBeInstanceOf(DiscordReadError)
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { listGuildMembers, DiscordReadError } from './discord'

function member(id: string, overrides: Record<string, unknown> = {}) {
  return { nick: null, user: { id, username: `user${id}`, global_name: null, bot: false }, ...overrides }
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('listGuildMembers', () => {
  it('pages until a short page comes back and passes the last id as after', async () => {
    vi.stubEnv('DISCORD_BOT_TOKEN', 'test-token')
    const firstPage = Array.from({ length: 1000 }, (_, i) => member(String(i + 1)))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse([member('1001')]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listGuildMembers('guild-1')

    expect(result).toHaveLength(1001)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('after=0')
    expect(fetchMock.mock.calls[1][0]).toContain('after=1000')
  })

  it('drops bots and maps nick and global_name', async () => {
    vi.stubEnv('DISCORD_BOT_TOKEN', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([
      member('1', { nick: 'Domca', user: { id: '1', username: 'dominik', global_name: 'Dominik', bot: false } }),
      member('2', { user: { id: '2', username: 'lunchbot', global_name: null, bot: true } }),
      member('3'),
    ])))

    const result = await listGuildMembers('guild-1')

    expect(result).toEqual([
      { discordId: '1', username: 'dominik', globalName: 'Dominik', nick: 'Domca' },
      { discordId: '3', username: 'user3', globalName: null, nick: null },
    ])
  })

  it('throws DiscordReadError carrying the status', async () => {
    vi.stubEnv('DISCORD_BOT_TOKEN', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Missing Access' }, 403)))

    await expect(listGuildMembers('guild-1')).rejects.toBeInstanceOf(DiscordReadError)
    await expect(listGuildMembers('guild-1')).rejects.toMatchObject({ status: 403 })
  })
})

import { describe, it, expect } from 'vitest'
import { evaluateDiscordAdmin } from './discordAuth'

describe('evaluateDiscordAdmin', () => {
  it('rejects when the interaction carries no Discord identity', () => {
    expect(evaluateDiscordAdmin(undefined, null)).toEqual({ ok: false, reason: 'no-identity' })
    expect(evaluateDiscordAdmin(null, null)).toEqual({ ok: false, reason: 'no-identity' })
  })

  it('rejects when no app user is linked to the Discord ID', () => {
    expect(evaluateDiscordAdmin('123456789012345678', null)).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('rejects a linked non-admin user', () => {
    expect(evaluateDiscordAdmin('123456789012345678', { role: 'USER' })).toEqual({
      ok: false,
      reason: 'not-admin',
    })
  })

  it('accepts a linked admin user', () => {
    expect(evaluateDiscordAdmin('123456789012345678', { role: 'ADMIN' })).toEqual({ ok: true })
  })
})

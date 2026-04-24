import { describe, it, expect } from 'vitest'
import { buildSekackaMessage } from './sekackaDiscordMessage'

describe('buildSekackaMessage', () => {
  const base = {
    orderId: 'order-1',
    creatorName: 'Ondra',
    items: [
      { name: 'Sekaná', price: 400 },
      { name: 'Rohlíky', price: 60 },
      { name: 'Hořčice', price: 30 },
    ],
    participantNames: ['Ondra', 'Alice', 'Bob', 'Carol', 'Dan', 'Eve'],
    status: 'OPEN' as const,
  }

  it('renders the open-state embed with both buttons', () => {
    const payload = buildSekackaMessage(base)
    expect(payload.embeds).toHaveLength(1)
    expect(payload.embeds[0].title).toContain('open')
    expect(payload.embeds[0].description).toContain('Total: **490 Kč**')
    expect(payload.embeds[0].description).toContain('≈ **81.67 Kč** / person')
    expect(payload.embeds[0].description).toContain('**Ondra** (creator)')
    expect(payload.components).toHaveLength(1)
    expect(payload.components[0].components).toHaveLength(2)
    expect(payload.components[0].components[0].custom_id).toBe('sekacka-join:order-1')
    expect(payload.components[0].components[1].custom_id).toBe('sekacka-leave:order-1')
  })

  it('drops buttons and switches to closed title when CLOSED', () => {
    const payload = buildSekackaMessage({ ...base, status: 'CLOSED' })
    expect(payload.embeds[0].title).toContain('closed')
    expect(payload.components).toHaveLength(0)
  })

  it('renders zero-participants placeholder gracefully', () => {
    const payload = buildSekackaMessage({ ...base, participantNames: [] })
    expect(payload.embeds[0].description).toContain('Participants: **0**')
    expect(payload.embeds[0].description).toContain('nobody yet')
  })

  it('computes per-person for a single participant', () => {
    const payload = buildSekackaMessage({
      ...base,
      participantNames: ['Ondra'],
    })
    expect(payload.embeds[0].description).toContain('≈ **490 Kč** / person')
  })
})

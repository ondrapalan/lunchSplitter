interface SekackaEmbedInput {
  orderId: string
  items: { name: string; price: number }[]
  participantNames: string[]
  creatorName: string
  status: 'OPEN' | 'CLOSED'
}

interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
}

interface DiscordButtonComponent {
  type: 2
  style: 1 | 2 | 3 | 4 | 5
  label: string
  custom_id?: string
  disabled?: boolean
}

interface DiscordActionRow {
  type: 1
  components: DiscordButtonComponent[]
}

export interface SekackaMessagePayload {
  embeds: DiscordEmbed[]
  components: DiscordActionRow[]
}

const OPEN_COLOR = 0xC47415
const CLOSED_COLOR = 0x178043

function formatKc(amount: number): string {
  return `${amount.toFixed(2).replace(/\.00$/, '')} Kč`
}

function formatItems(items: { name: string; price: number }[]): string {
  if (items.length === 0) return '_(žádné položky)_'
  return items.map(i => `${i.name} **${formatKc(i.price)}**`).join(' • ')
}

function formatParticipantList(creatorName: string, participantNames: string[]): string {
  const decorated = participantNames.map(n => n === creatorName ? `**${n}** (autor)` : n)
  if (decorated.length === 0) return '_(zatím nikdo — klikni Popiči níže)_'
  return decorated.join(' • ')
}

export function buildSekackaMessage(input: SekackaEmbedInput): SekackaMessagePayload {
  const { orderId, items, participantNames, creatorName, status } = input
  const total = items.reduce((sum, i) => sum + i.price, 0)
  const perPerson = participantNames.length > 0 ? total / participantNames.length : 0
  const isOpen = status === 'OPEN'

  const title = isOpen ? '🥩 Sekačka! (otevřeno)' : '✅ Sekačka (uzavřeno)'
  const description = [
    formatItems(items),
    '',
    `Celkem: **${formatKc(total)}**`,
    participantNames.length > 0
      ? `Účastníků: **${participantNames.length}** (vč. autora)  ≈ **${formatKc(perPerson)}** / osobu`
      : 'Účastníků: **0**',
    '',
    formatParticipantList(creatorName, participantNames),
  ].join('\n')

  const embed: DiscordEmbed = {
    title,
    description,
    color: isOpen ? OPEN_COLOR : CLOSED_COLOR,
  }

  const components: DiscordActionRow[] = isOpen
    ? [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3, // Success (green) — Popiči
              label: '🍞 Popiči',
              custom_id: `sekacka-join:${orderId}`,
            },
            {
              type: 2,
              style: 4, // Danger (red) — Nechci
              label: '🚪 Nechci',
              custom_id: `sekacka-leave:${orderId}`,
            },
          ],
        },
      ]
    : []

  return { embeds: [embed], components }
}

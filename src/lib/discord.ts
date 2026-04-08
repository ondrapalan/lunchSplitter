const DISCORD_API = 'https://discord.com/api/v10'

function getHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN not configured')
  return {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  }
}

interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  image?: { url: string }
}

interface DiscordButtonComponent {
  type: 2 // Button
  style: 1 | 2 | 3 | 4 | 5 // Primary, Secondary, Success, Danger, Link
  label: string
  custom_id?: string
  disabled?: boolean
}

interface DiscordActionRow {
  type: 1 // Action Row
  components: DiscordButtonComponent[]
}

interface SendMessageOptions {
  content?: string
  embeds?: DiscordEmbed[]
  components?: DiscordActionRow[]
}

async function discordFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Discord API error ${res.status}: ${body}`)
  }
  return res.json()
}

/**
 * Create a DM channel with a user and return the channel ID.
 */
async function createDmChannel(discordUserId: string): Promise<string> {
  const channel = await discordFetch('/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: discordUserId }),
  }) as { id: string }
  return channel.id
}

/**
 * Send a message to a Discord channel (including DM channels).
 */
export async function sendChannelMessage(channelId: string, message: SendMessageOptions): Promise<{ id: string }> {
  return discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  }) as Promise<{ id: string }>
}

/**
 * Edit an existing message in a channel.
 */
export async function editChannelMessage(
  channelId: string,
  messageId: string,
  message: Partial<SendMessageOptions>,
): Promise<void> {
  await discordFetch(`/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(message),
  })
}

/**
 * Send a DM to a Discord user with payment QR code info.
 */
export async function sendPaymentDm(
  discordUserId: string,
  opts: {
    restaurantName: string
    amount: number
    orderPersonId: string
    qrDataUrl: string
    orderDate: string
  },
): Promise<{ channelId: string; messageId: string }> {
  const channelId = await createDmChannel(discordUserId)

  const message = await sendChannelMessage(channelId, {
    embeds: [
      {
        title: `Payment for ${opts.restaurantName}`,
        description: `You owe **${opts.amount.toFixed(2)} CZK** for lunch on ${opts.orderDate}.`,
        color: 0x1C5DB7, // Primary blue from theme
        image: { url: opts.qrDataUrl },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3, // Success (green)
            label: 'Confirm Payment',
            custom_id: `confirm-payment:${opts.orderPersonId}`,
          },
        ],
      },
    ],
  })

  return { channelId, messageId: message.id }
}

/**
 * Check if Discord bot is configured.
 */
export function isDiscordConfigured(): boolean {
  return !!(
    process.env.DISCORD_BOT_TOKEN &&
    process.env.DISCORD_APPLICATION_ID &&
    process.env.DISCORD_PUBLIC_KEY
  )
}

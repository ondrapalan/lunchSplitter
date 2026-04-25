const DISCORD_API = 'https://discord.com/api/v10'

function isDryRun(): boolean {
  return process.env.DISCORD_DRY_RUN === '1'
}

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
  if (isDryRun()) {
    console.info('[discord:dry-run]', options.method ?? 'GET', path)
    return { id: 'dry-run' }
  }
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
 * Optionally attach files via multipart/form-data.
 */
export async function sendChannelMessage(
  channelId: string,
  message: SendMessageOptions,
  files?: { name: string; data: Buffer }[],
): Promise<{ id: string }> {
  if (!files || files.length === 0) {
    return discordFetch(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    }) as Promise<{ id: string }>
  }

  if (isDryRun()) {
    console.info('[discord:dry-run] POST', `/channels/${channelId}/messages`, `(${files.length} file(s))`)
    return { id: 'dry-run' }
  }

  // Multipart form-data for file attachments
  const form = new FormData()
  form.append('payload_json', JSON.stringify(message))
  for (let i = 0; i < files.length; i++) {
    form.append(`files[${i}]`, new Blob([new Uint8Array(files[i].data)]), files[i].name)
  }

  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN not configured')

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}` },
    body: form,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Discord API error ${res.status}: ${body}`)
  }
  return res.json() as Promise<{ id: string }>
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
    qrPngBuffer: Buffer
    orderDate: string
  },
): Promise<{ channelId: string; messageId: string }> {
  const channelId = await createDmChannel(discordUserId)

  const message = await sendChannelMessage(
    channelId,
    {
      embeds: [
        {
          title: `Payment for ${opts.restaurantName}`,
          description: `You owe **${opts.amount.toFixed(2)} CZK** for lunch on ${opts.orderDate}.`,
          color: 0x1C5DB7, // Primary blue from theme
          image: { url: 'attachment://qr-payment.png' },
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
    },
    [{ name: 'qr-payment.png', data: opts.qrPngBuffer }],
  )

  return { channelId, messageId: message.id }
}

/**
 * Send a DM to an admin about an unresolved Discord→User linkage that was
 * created when an unlinked Discord account clicked Popiči on a Sekačka.
 */
export async function sendPendingLinkDm(
  adminDiscordId: string,
  opts: {
    pendingLinkId: string
    discordDisplayName: string
    discordUsername: string
    orderId: string
    adminPageUrl: string
  },
): Promise<string> {
  const channelId = await createDmChannel(adminDiscordId)

  const message = await sendChannelMessage(channelId, {
    embeds: [
      {
        title: 'Unlinked Discord user',
        description:
          `**${opts.discordDisplayName}** (\`@${opts.discordUsername}\`) clicked Popiči on a Sekačka, ` +
          `but their Discord isn't linked to any user.\n\n` +
          `Resolve here: ${opts.adminPageUrl}`,
        color: 0xC47415,
      },
    ],
  })

  return message.id
}

/**
 * Send a DM to an admin about a new access request.
 */
export async function sendAccessRequestDm(
  adminDiscordId: string,
  opts: {
    requestId: string
    username: string
    displayName: string
  },
): Promise<string> {
  const channelId = await createDmChannel(adminDiscordId)

  const message = await sendChannelMessage(channelId, {
    embeds: [
      {
        title: 'New Access Request',
        description: `**${opts.displayName}** (username: \`${opts.username}\`) wants to join Lunch Splitter.`,
        color: 0xC47415, // Accent color from theme
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3, // Success (green)
            label: 'Approve',
            custom_id: `approve-access:${opts.requestId}`,
          },
          {
            type: 2,
            style: 4, // Danger (red)
            label: 'Deny',
            custom_id: `deny-access:${opts.requestId}`,
          },
        ],
      },
    ],
  })

  return message.id
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

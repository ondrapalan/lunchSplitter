import type { StatPeriod } from '~/features/stats/types'

export const qk = {
  orders: {
    all: ['orders'] as const,
    open: () => ['orders', 'open'] as const,
    my: () => ['orders', 'my'] as const,
    admin: () => ['orders', 'admin'] as const,
    byId: (id: string) => ['orders', 'byId', id] as const,
    itemsByRestaurant: (name: string) => ['orders', 'items', name] as const,
    restaurantNames: () => ['orders', 'restaurantNames'] as const,
    paymentConfirmations: (id: string) => ['orders', 'paymentConfirmations', id] as const,
  },
  stats: {
    all: ['stats'] as const,
    bundle: (period: StatPeriod) => ['stats', 'bundle', period] as const,
  },
  users: {
    all: ['users'] as const,
    registered: () => ['users', 'registered'] as const,
    list: () => ['users', 'list'] as const,
  },
  guests: {
    all: ['guests'] as const,
    list: () => ['guests', 'list'] as const,
    withStats: () => ['guests', 'withStats'] as const,
    legacyNames: () => ['guests', 'legacy'] as const,
  },
  sekacka: {
    all: ['sekacka'] as const,
    byId: (id: string) => ['sekacka', id] as const,
  },
  discordLinks: {
    all: ['discordLinks'] as const,
    pending: () => ['discordLinks', 'pending'] as const,
    pickableUsers: () => ['discordLinks', 'pickableUsers'] as const,
  },
  items: {
    all: ['items'] as const,
    nameUsage: () => ['items', 'nameUsage'] as const,
  },
  account: {
    all: ['account'] as const,
    bankAccount: () => ['account', 'bankAccount'] as const,
  },
} as const

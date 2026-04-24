import { unstable_cache } from 'next/cache'

type CacheOptions = {
  tags: string[]
  revalidate: number
}

export function cached<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  keyParts: string[],
  options: CacheOptions | ((...args: Args) => CacheOptions),
): (...args: Args) => Promise<R> {
  return (...args: Args) => {
    const opts = typeof options === 'function' ? options(...args) : options
    const dynamicKey = [...keyParts, ...args.map(String)]
    return unstable_cache(fn, dynamicKey, { tags: opts.tags, revalidate: opts.revalidate })(...args)
  }
}

export const ORDER_TAGS = {
  open: 'orders:open',
  list: 'orders:list',
  closed: 'orders:closed',
  admin: 'orders:admin',
  byId: (id: string) => `order:${id}`,
  restaurantNames: 'restaurants:names',
  itemsByRestaurant: (name: string) => `items:restaurant:${name}`,
  itemsAll: 'items:all',
  users: 'users:registered',
  usersAll: 'users:all',
  guests: 'guests:list',
} as const

export function allOrderReadTags(): string[] {
  return [
    ORDER_TAGS.open,
    ORDER_TAGS.list,
    ORDER_TAGS.closed,
    ORDER_TAGS.admin,
    ORDER_TAGS.itemsAll,
  ]
}

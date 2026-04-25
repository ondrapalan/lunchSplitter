import { PrismaClient, OrderStatus, OrderType, Role, ActivitySource, OrderActivityAction } from '@prisma/client'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────────────────────────────────────
// LAST-LINE SAFETY RAIL — runs before `new PrismaClient()` below.
// Prisma's auto-loader only reads `.env`, not `.env.local`, so without the
// `dotenv -e .env -e .env.local` wrapper DATABASE_URL can silently resolve to
// the production Neon URL. This incident happened once already. NEVER remove.
// ─────────────────────────────────────────────────────────────────────────────
{
  const url = process.env.DATABASE_URL ?? ''
  const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)
  if (!isLocal) {
    const redacted = url.replace(/\/\/[^@]+@/, '//***:***@')
    console.error(
      `[seed:dev] REFUSING TO RUN — DATABASE_URL is not localhost.\n` +
      `  Got: ${redacted || '(empty)'}\n` +
      `  Fix: run via \`npm run dev:clean\`, or prefix with \`dotenv -e .env.local -e .env --\` (note: .env.local must come FIRST so its values win).`
    )
    process.exit(1)
  }
}

const prisma = new PrismaClient()

const TEST_PASSWORD = 'heslo'

const USERS = [
  { username: 'alice',     displayName: 'Alice Nováková',      bankAccountNumber: '1234567890/1100', role: 'USER' as const },
  { username: 'bob',       displayName: 'Bob Svoboda',         bankAccountNumber: '234567891/0800',  role: 'USER' as const },
  { username: 'cecilie',   displayName: 'Cecílie Dvořáková',   bankAccountNumber: null,              role: 'USER' as const },
  { username: 'david',     displayName: 'David Horák',         bankAccountNumber: '9876543210/0300', role: 'USER' as const },
  { username: 'eva',       displayName: 'Eva Procházková',     bankAccountNumber: '5550001/2010',    role: 'USER' as const },
  { username: 'frantisek', displayName: 'František Kučera',    bankAccountNumber: '111222333/0100',  role: 'ADMIN' as const },
]

const RESTAURANTS = ['Pizza Modena', 'Menza u Madly', 'Bistro Zdravá Výživa', 'Asijské Bistro Hanoi']

type OrderFx = {
  daysAgo: number
  restaurant: string
  createdBy: string
  globalDiscountPercent?: number
  fees?: { name: string; amount: number }[]
  people: {
    user: string
    items: { name: string; price: number; isPackaging?: boolean; discountPercent?: number }[]
    paid?: boolean
  }[]
}

const ORDERS: OrderFx[] = [
  {
    daysAgo: 17, restaurant: 'Menza u Madly', createdBy: 'cecilie',
    people: [
      { user: 'cecilie', items: [{ name: 'Kuřecí řízek s bramborem', price: 149 }, { name: 'Coca-Cola 0,33', price: 35 }], paid: true },
      { user: 'eva',     items: [{ name: 'Vepřo knedlo zelo', price: 159 }, { name: 'Voda 0,5', price: 25 }], paid: true },
    ],
  },
  {
    daysAgo: 14, restaurant: 'Pizza Modena', createdBy: 'alice',
    fees: [{ name: 'Rozvoz', amount: 50 }],
    people: [
      { user: 'alice',   items: [{ name: 'Pizza Margherita', price: 189 }], paid: true },
      { user: 'bob',     items: [{ name: 'Pizza Quattro Formaggi', price: 229 }, { name: 'Cola 0,5', price: 45 }], paid: true },
      { user: 'cecilie', items: [{ name: 'Pizza Diavola', price: 239 }], paid: true },
      { user: 'david',   items: [{ name: 'Lasagne Bolognese', price: 219 }, { name: 'Obalový materiál', price: 10, isPackaging: true }], paid: true },
    ],
  },
  {
    daysAgo: 12, restaurant: 'Menza u Madly', createdBy: 'bob',
    globalDiscountPercent: 10,
    people: [
      { user: 'bob',       items: [{ name: 'Svíčková na smetaně', price: 169 }, { name: 'Polévka dne', price: 45 }], paid: true },
      { user: 'eva',       items: [{ name: 'Guláš hovězí', price: 175 }], paid: true },
      { user: 'frantisek', items: [{ name: 'Smažený sýr s hranolkami', price: 155 }, { name: 'Kofola 0,4', price: 38 }], paid: false },
    ],
  },
  {
    daysAgo: 10, restaurant: 'Pizza Modena', createdBy: 'eva',
    fees: [{ name: 'Obalový materiál', amount: 15 }],
    people: [
      { user: 'alice',     items: [{ name: 'Pizza Prosciutto', price: 209 }], paid: true },
      { user: 'bob',       items: [{ name: 'Pizza Capricciosa', price: 219 }], paid: true },
      { user: 'eva',       items: [{ name: 'Penne all\'Arrabiata', price: 179 }], paid: true },
      { user: 'frantisek', items: [{ name: 'Calzone', price: 229 }, { name: 'Tiramisu', price: 89 }], paid: false },
      { user: 'david',     items: [{ name: 'Spaghetti Carbonara', price: 199 }], paid: false },
    ],
  },
  {
    daysAgo: 8, restaurant: 'Asijské Bistro Hanoi', createdBy: 'david',
    people: [
      { user: 'david', items: [{ name: 'Pho bo', price: 189 }, { name: 'Jarní závitky 3ks', price: 99 }], paid: true },
      { user: 'alice', items: [{ name: 'Bun cha', price: 199 }, { name: 'Vietnamská káva', price: 55 }], paid: true },
    ],
  },
  {
    daysAgo: 6, restaurant: 'Menza u Madly', createdBy: 'alice',
    globalDiscountPercent: 5,
    fees: [{ name: 'Rozvoz', amount: 80 }],
    people: [
      { user: 'alice',   items: [{ name: 'Kuřecí Caesar salát', price: 189 }], paid: true },
      { user: 'bob',     items: [{ name: 'Hovězí tataráček s topinkou', price: 229 }, { name: 'Plzeň 0,5', price: 55 }], paid: true },
      { user: 'cecilie', items: [{ name: 'Řízek s bramborovou kaší', price: 165 }], paid: true },
      { user: 'eva',     items: [{ name: 'Špagety Aglio e Olio', price: 155 }], paid: true },
    ],
  },
  {
    daysAgo: 4, restaurant: 'Bistro Zdravá Výživa', createdBy: 'frantisek',
    people: [
      { user: 'frantisek', items: [{ name: 'Quinoa bowl s kuřetem', price: 195 }, { name: 'Zelený smoothie', price: 79 }], paid: true },
      { user: 'david',     items: [{ name: 'Caesar salát s lososem', price: 215 }], paid: false },
      { user: 'alice',     items: [{ name: 'Buddha bowl veggie', price: 179 }, { name: 'Matcha latte', price: 89 }], paid: false },
    ],
  },
  {
    daysAgo: 2, restaurant: 'Pizza Modena', createdBy: 'bob',
    fees: [{ name: 'Rozvoz', amount: 50 }],
    people: [
      { user: 'bob',       items: [{ name: 'Pizza Hawaii', price: 209 }], paid: true },
      { user: 'cecilie',   items: [{ name: 'Pizza Funghi', price: 189 }, { name: 'Česnekový chléb', price: 49 }], paid: false },
      { user: 'david',     items: [{ name: 'Pizza Salami', price: 199 }], paid: true },
      { user: 'eva',       items: [{ name: 'Penne Pesto', price: 175 }], paid: false },
      { user: 'frantisek', items: [{ name: 'Pizza Vegetariana', price: 195 }, { name: 'Tiramisu', price: 89 }], paid: false },
    ],
  },
  {
    daysAgo: 1, restaurant: 'Asijské Bistro Hanoi', createdBy: 'alice',
    globalDiscountPercent: 15,
    people: [
      { user: 'alice',   items: [{ name: 'Ramen Tonkotsu', price: 219 }], paid: false },
      { user: 'bob',     items: [{ name: 'Pad Thai s krevetami', price: 245 }, { name: 'Zázvorový čaj', price: 49 }], paid: false },
      { user: 'cecilie', items: [{ name: 'Bun bo nam bo', price: 209 }], paid: false },
      { user: 'david',   items: [{ name: 'Pho ga', price: 179 }, { name: 'Jarní závitky 3ks', price: 99 }], paid: false },
    ],
  },
]

function daysAgoDate(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0)
  return d
}

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10)
  const userHash = await bcrypt.hash(TEST_PASSWORD, 10)

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminHash, displayName: 'Admin', role: Role.ADMIN, isFirstLogin: false },
  })

  const usersByUsername = new Map<string, string>()
  for (const u of USERS) {
    const created = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash: userHash,
        displayName: u.displayName,
        role: u.role === 'ADMIN' ? Role.ADMIN : Role.USER,
        bankAccountNumber: u.bankAccountNumber,
        isFirstLogin: false,
      },
    })
    usersByUsername.set(u.username, created.id)
  }

  const restaurantsByName = new Map<string, string>()
  for (const name of RESTAURANTS) {
    const r = await prisma.restaurant.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    restaurantsByName.set(name, r.id)
  }

  for (const fx of ORDERS) {
    const createdById = usersByUsername.get(fx.createdBy)
    const restaurantId = restaurantsByName.get(fx.restaurant)
    if (!createdById || !restaurantId) throw new Error(`Missing reference in fixture: ${fx.restaurant} / ${fx.createdBy}`)

    const orderDate = daysAgoDate(fx.daysAgo)

    const order = await prisma.order.create({
      data: {
        restaurantId,
        createdById,
        status: OrderStatus.CLOSED,
        type: OrderType.NORMAL,
        globalDiscountPercent: fx.globalDiscountPercent ?? 0,
        createdAt: orderDate,
        updatedAt: orderDate,
        feeAdjustments: fx.fees
          ? { create: fx.fees.map((f, i) => ({ name: f.name, amount: f.amount, sortOrder: i })) }
          : undefined,
        activityLog: {
          create: [
            { action: OrderActivityAction.CREATED, source: ActivitySource.WEB, actorUserId: createdById, createdAt: orderDate },
            { action: OrderActivityAction.CLOSED,  source: ActivitySource.WEB, actorUserId: createdById, createdAt: orderDate },
          ],
        },
      },
    })

    for (let pIdx = 0; pIdx < fx.people.length; pIdx++) {
      const pFx = fx.people[pIdx]
      const userId = usersByUsername.get(pFx.user)
      if (!userId) throw new Error(`Unknown user in fixture: ${pFx.user}`)
      const userRow = USERS.find(u => u.username === pFx.user)!

      const person = await prisma.orderPerson.create({
        data: {
          orderId: order.id,
          userId,
          name: userRow.displayName,
          sortOrder: pIdx,
          items: {
            create: pFx.items.map((it, iIdx) => ({
              name: it.name,
              price: it.price,
              sortOrder: iIdx,
              isPackaging: it.isPackaging ?? false,
              discountPercent: it.discountPercent ?? null,
            })),
          },
        },
      })

      if (pFx.paid) {
        await prisma.paymentConfirmation.create({
          data: {
            orderPersonId: person.id,
            confirmedAt: orderDate,
            confirmedVia: 'seed',
          },
        })
      }
    }
  }

  const orderCount = await prisma.order.count()
  const userCount = await prisma.user.count()
  console.log(`[seed:dev] ${userCount} users (password "${TEST_PASSWORD}" for test users, "admin123" for admin)`)
  console.log(`[seed:dev] ${RESTAURANTS.length} restaurants, ${orderCount} closed orders across ~3 weeks`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

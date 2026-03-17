import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { authConfig } from './auth.config'

// Dummy hash for timing-safe comparison when user not found
const DUMMY_HASH = '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const username = typeof credentials?.username === 'string' ? credentials.username : null
        const password = typeof credentials?.password === 'string' ? credentials.password : null
        if (!username || !password) return null

        const user = await prisma.user.findUnique({
          where: { username },
        })
        if (!user) {
          // Prevent timing-based username enumeration
          await bcrypt.compare(password, DUMMY_HASH)
          return null
        }

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.displayName,
          role: user.role,
          isFirstLogin: user.isFirstLogin,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})

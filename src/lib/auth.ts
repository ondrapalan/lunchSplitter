import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { authConfig } from './auth.config'

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const { username, password } = credentials as {
          username: string
          password: string
        }

        const user = await prisma.user.findUnique({
          where: { username },
        })
        if (!user) return null

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
  },
})

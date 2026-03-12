import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!
        token.role = user.role
        token.isFirstLogin = user.isFirstLogin
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as 'ADMIN' | 'USER'
      session.user.isFirstLogin = token.isFirstLogin as boolean
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig

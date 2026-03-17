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
      session.user.id = typeof token.id === 'string' ? token.id : ''
      session.user.role = (token.role === 'ADMIN' || token.role === 'USER') ? token.role : 'USER'
      session.user.isFirstLogin = typeof token.isFirstLogin === 'boolean' ? token.isFirstLogin : false
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig

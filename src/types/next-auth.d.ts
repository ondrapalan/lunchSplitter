import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: 'ADMIN' | 'USER'
    isFirstLogin: boolean
  }

  interface Session {
    user: {
      id: string
      role: 'ADMIN' | 'USER'
      isFirstLogin: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'USER'
    isFirstLogin: boolean
  }
}

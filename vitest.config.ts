import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // DB-backed tests share a Postgres sandbox — run sequentially to avoid races.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '~': '/src',
      // `server-only` is a Next.js marker that throws when imported in client code;
      // vitest doesn't have a resolver for it, so stub it as a no-op.
      'server-only': '/src/test-stubs/server-only.ts',
    },
  },
})

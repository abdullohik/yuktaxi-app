import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Detect Turso/LibSQL URL — if present, use the driver adapter for Vercel
function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? ''

  // Turso URLs start with "libsql://" — use the LibSQL driver adapter
  if (dbUrl.startsWith('libsql://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client')

    const libsql = createClient({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN ?? '',
    })

    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
    })
  }

  // Local SQLite (dev environment)
  return new PrismaClient({
    log: ['query'],
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
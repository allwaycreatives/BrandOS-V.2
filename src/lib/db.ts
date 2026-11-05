import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// The database client. It talks to Postgres through a driver adapter (no Rust engine), which is what lets this run on Cloudflare
// Workers, and keeps it small.
//
// On a normal Node server (your computer, Render, Vercel) one client is shared by everything, as before.
// On Cloudflare Workers a connection can only be used by the request that opened it, so each request gets its own client.
// Everything else in the app keeps importing `db` and never needs to know the difference.

const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const perRequest = new WeakMap<object, PrismaClient>()

function create(connectionString: string | undefined): PrismaClient {
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

function client(): PrismaClient {
  if (!isWorkers) return (globalForPrisma.prisma ??= create(process.env.DATABASE_URL))
  const { env, ctx } = getCloudflareContext()
  let c = perRequest.get(ctx)
  if (!c) {
    // A Hyperdrive binding (Cloudflare's free connection pooler) is used when it is set up; otherwise the plain DATABASE_URL.
    const hyperdrive = (env as unknown as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE
    c = create(hyperdrive?.connectionString ?? process.env.DATABASE_URL)
    perRequest.set(ctx, c)
  }
  return c
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client()
    const value = Reflect.get(c, prop, c)
    return typeof value === 'function' ? value.bind(c) : value
  },
})

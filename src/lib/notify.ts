import { db } from './db'

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return ''
}

// Email is optional. It turns on when RESEND_API_KEY and EMAIL_FROM are set in Vercel; otherwise it is skipped.
async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  })
}

// Tells everyone on the team side of a brand (workspace owners and team members, never clients).
export async function notifyBrandTeam(args: { brandSpaceId: string; title: string; body?: string; href: string }) {
  const brand = await db.brandSpace.findUnique({ where: { id: args.brandSpaceId }, select: { organizationId: true } })
  if (!brand) return

  const owners = await db.membership.findMany({ where: { organizationId: brand.organizationId }, select: { userId: true } })
  const team = await db.brandSpaceAccess.findMany({ where: { brandSpaceId: args.brandSpaceId, role: { not: 'client' } }, select: { userId: true } })
  const userIds = Array.from(new Set([...owners, ...team].map((r) => r.userId)))
  if (userIds.length === 0) return

  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, brandSpaceId: args.brandSpaceId, title: args.title, body: args.body ?? null, href: args.href })),
  })

  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { email: true } })
  const link = `${appUrl()}${args.href}`
  await Promise.allSettled(
    users.filter((u) => u.email).map((u) => sendEmail(u.email as string, args.title, `${args.title}\n\n${args.body ? `${args.body}\n\n` : ''}Open it: ${link}`))
  )
}

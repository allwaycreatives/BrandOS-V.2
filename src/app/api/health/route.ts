// A tiny "is the app alive?" address. Hosts and uptime checkers call it; it touches nothing else.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}

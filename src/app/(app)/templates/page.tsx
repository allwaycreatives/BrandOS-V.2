import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import UseTemplate from './UseTemplate'
import type { TemplatePayload } from './actions'

const SERIF = "Georgia, 'Times New Roman', serif"
const GROUPS = [
  { kind: 'project', title: 'Project templates' },
  { kind: 'campaign', title: 'Campaign templates' },
  { kind: 'board', title: 'Board templates' },
]

function describe(kind: string, p: TemplatePayload) {
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`
  if (kind === 'board') return n(p.cards?.length ?? 0, 'card', 'cards')
  if (kind === 'campaign') return `${n(p.content?.length ?? 0, 'content idea', 'content ideas')} · ${n(p.tasks?.length ?? 0, 'task', 'tasks')}`
  return `${n(p.tasks?.length ?? 0, 'task', 'tasks')} · ${n(p.boards?.length ?? 0, 'board', 'boards')}`
}

export default async function TemplatesPage() {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client').map((b) => ({ id: b.id, name: b.name }))
  const templates = await db.template.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }).catch(() => [])

  return (
    <div>
      <div className="topbar-greeting">Templates</div>
      <div className="topbar-sub" style={{ marginBottom: 22 }}>Your own setups, saved once and used for any brand. Open a board, campaign or project and press Save as template.</div>

      {templates.length === 0 && (
        <div className="card-empty">
          No templates yet. Set up something that works, like your standard client onboarding, then save it here and reuse it for every new client.
        </div>
      )}

      {GROUPS.map((g) => {
        const list = templates.filter((t) => t.kind === g.kind)
        if (list.length === 0) return null
        return (
          <div key={g.kind} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{g.title} · {list.length}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
              {list.map((t) => (
                <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16 }}>{t.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>{describe(t.kind, t.payloadJson as unknown as TemplatePayload)}</div>
                  {brands.length > 0 ? <UseTemplate templateId={t.id} brands={brands} /> : <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Create a brand first.</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

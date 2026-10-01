import { createIdea, promoteIdea, archiveIdea, deleteIdea } from '@/app/(app)/brand-spaces/[id]/ideas/actions'

type Brand = { id: string; name: string; color: string }
type Idea = { id: string; brandSpaceId: string; title: string; notes: string | null }

const small: React.CSSProperties = { padding: '3px 10px', fontSize: 12 }

// Shared by the all-brands Ideas page and each brand's own Ideas page.
export default function IdeaList({ ideas, brands, fixedBrandId }: { ideas: Idea[]; brands: Brand[]; fixedBrandId?: string }) {
  const brandById = new Map(brands.map((b) => [b.id, b]))
  return (
    <div>
      {brands.length > 0 ? (
        <form action={createIdea} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input name="title" required placeholder="Park an idea, e.g. Behind-the-scenes series" style={{ flex: 1, minWidth: 220 }} />
            {fixedBrandId ? (
              <input type="hidden" name="brandSpaceId" value={fixedBrandId} />
            ) : (
              <select name="brandSpaceId" defaultValue={brands[0].id}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button className="primary" type="submit">Save idea</button>
          </div>
          <input name="notes" placeholder="A line of detail (optional)" />
        </form>
      ) : (
        <div className="card-empty" style={{ marginBottom: 24 }}>Create a brand first, then park ideas for it.</div>
      )}

      {ideas.length === 0 && brands.length > 0 && <div className="card-empty">No open ideas. Anything you think of goes here, no pressure to act on it yet.</div>}

      {ideas.map((idea) => {
        const brand = brandById.get(idea.brandSpaceId)
        return (
          <div key={idea.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              {brand && !fixedBrandId && <span style={{ width: 8, height: 8, borderRadius: '50%', background: brand.color, flexShrink: 0 }} />}
              <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600, fontSize: 15 }}>{idea.title}</span>
              {brand && !fixedBrandId && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{brand.name}</span>}
            </div>
            {idea.notes && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>{idea.notes}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: idea.notes ? 0 : 8 }}>
              <form action={promoteIdea.bind(null, idea.id, 'campaign')}>
                <button type="submit" style={small}>Make it a campaign</button>
              </form>
              <form action={promoteIdea.bind(null, idea.id, 'project')}>
                <button type="submit" style={small}>Make it a project</button>
              </form>
              <form action={archiveIdea.bind(null, idea.id)}>
                <button type="submit" style={small}>Archive</button>
              </form>
              <form action={deleteIdea.bind(null, idea.id)}>
                <button type="submit" style={{ ...small, color: 'var(--text-muted)' }}>Delete</button>
              </form>
            </div>
          </div>
        )
      })}
    </div>
  )
}

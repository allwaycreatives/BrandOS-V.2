import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { setNotionEmbedUrl } from './actions'

export default async function NotionPage({ params }: { params: { id: string } }) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!brandSpace) notFound()

  const setWithId = setNotionEmbedUrl.bind(null, params.id)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Notion</div>
        <div className="topbar-sub">View a connected Notion page right here, without opening a new tab.</div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          In Notion, open the page you want to connect, click <strong>Share</strong>, turn on <strong>Share to web</strong>, and paste that link below.
        </div>
        <form action={setWithId} style={{ display: 'flex', gap: 8 }}>
          <input name="url" defaultValue={brandSpace!.notionEmbedUrl || ''} placeholder="https://www.notion.so/..." style={{ flex: 1 }} />
          <button className="primary" type="submit">Connect</button>
        </form>
      </div>

      {brandSpace!.notionEmbedUrl ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', height: '70vh' }}>
          <iframe
            src={brandSpace!.notionEmbedUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Connected Notion page"
          />
        </div>
      ) : (
        <div className="card-empty">No Notion page connected yet.</div>
      )}
    </div>
  )
}

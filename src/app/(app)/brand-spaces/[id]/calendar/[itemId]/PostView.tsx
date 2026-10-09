import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import CalendarItemForm from './CalendarItemForm'
import MakeVersion from './MakeVersion'
import { parseStrategy } from '@/lib/strategy'
import { addPostReply, sendBackForApproval } from '../actions'
import { dayKey, CLIENT_STATUS_TEAM, KIND_WORD, visibleToClient } from '@/lib/plan'

const when = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// One post: title, properties, brief, and the conversation with the client. Used by the panel and by the full page.
export default async function PostView({ brandSpaceId, itemId }: { brandSpaceId: string; itemId: string }) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access) notFound()

  const item = await db.calendarItem.findUnique({ where: { id: itemId }, include: { feedback: { orderBy: { createdAt: 'asc' } } } }).catch(() => null)
  if (!item || item.brandSpaceId !== brandSpaceId) notFound()
  const canEdit = access.role !== 'client'
  const token = access.brandSpace.planToken
  const shown = visibleToClient(item.status)
  const open = item.feedback.filter((f) => f.fromClient && f.kind === 'changes_requested' && !f.resolved).length

  const reply = addPostReply.bind(null, brandSpaceId, item.id)
  const sendBack = sendBackForApproval.bind(null, brandSpaceId, item.id)

  return (
    <div>
      {canEdit ? (
        <CalendarItemForm
          brandSpaceId={brandSpaceId}
          itemId={item.id}
          initial={{
            title: item.title,
            platform: item.platform,
            hook: item.hook || '',
            keyMessage: item.keyMessage || '',
            script: item.script || '',
            caption: item.caption || '',
            assetUrl: item.assetUrl || '',
            thumbnailUrl: item.thumbnailUrl || '',
            scheduledDate: item.scheduledDate ? dayKey(item.scheduledDate) : '',
            publishTime: item.publishTime || '',
            productionDate: item.productionDate ? dayKey(item.productionDate) : '',
            status: item.status,
            contentType: item.contentType || '',
            priority: item.priority,
            pillar: item.pillar || '',
            series: item.series || '',
            hookOptions: item.hookOptions,
            objective: item.objective || '',
            cta: item.cta || '',
            productionNotes: item.productionNotes || '',
            successMetric: item.successMetric || '',
            notes: item.notes || '',
          }}
          strategy={parseStrategy(access.brandSpace.strategy)}
          clientLine={`Client review: ${CLIENT_STATUS_TEAM[item.clientStatus] ?? item.clientStatus}${shown ? '' : ' · hidden from the client until it is moved out of Idea'}`}
        />
      ) : (
        <>
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, fontWeight: 600, margin: '0 0 12px' }}>{item.title}</h1>
          <div className="card" style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.caption || 'No caption yet.'}</div>
        </>
      )}

      {canEdit && <MakeVersion brandSpaceId={brandSpaceId} itemId={item.id} platform={item.platform} />}

      <div className="card" style={{ marginTop: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>Client conversation</div>
          {token && shown && (
            <a href={`/share/plan/${token}/${item.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>See what the client sees ↗</a>
          )}
        </div>

        {item.feedback.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {token ? 'Nothing from the client yet.' : 'Share the plan from the Calendar page to start collecting feedback.'}
          </div>
        ) : (
          item.feedback.map((f) => (
            <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>{f.authorName}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {f.fromClient ? KIND_WORD[f.kind] : 'Team'} · {when(f.createdAt)}
                  {f.at ? ` · at ${f.at}` : ''}
                </span>
                {f.fromClient && f.kind === 'changes_requested' && f.resolved && <span style={{ fontSize: 11.5, color: 'var(--accent-text)' }}>Addressed</span>}
              </div>
              {f.body && <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{f.body}</div>}
            </div>
          ))
        )}

        {canEdit && (
          <>
            <form action={reply} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <input name="body" placeholder="Reply to the client..." style={{ flex: '1 1 220px' }} />
              <button type="submit">Reply</button>
            </form>
            {(item.clientStatus === 'changes_requested' || open > 0) && (
              <form action={sendBack} style={{ marginTop: 12 }}>
                <button className="primary" type="submit">I&apos;ve made the changes: ask for approval again</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

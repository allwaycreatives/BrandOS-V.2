import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { STAGES } from '../constants'
import {
  updateCampaign,
  addCampaignContent,
  setContentStatus,
  addCampaignTask,
  setCampaignTaskStatus,
  duplicateCampaign,
} from '../actions'
import DeleteCampaignButton from '../DeleteCampaignButton'
import { PLATFORMS } from '../constants'

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')
const SERIF = "Georgia, 'Times New Roman', serif"
const smallBtn: React.CSSProperties = { padding: '1px 7px', fontSize: 11 }

export default async function CampaignPage({ params }: { params: { id: string; campaignId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()

  const campaign = await db.campaign.findUnique({ where: { id: params.campaignId } }).catch(() => null)
  if (!campaign || campaign.brandSpaceId !== params.id) notFound()

  const items = await db.calendarItem.findMany({ where: { campaignId: campaign.id }, orderBy: { createdAt: 'asc' } }).catch(() => [])
  const tasks = await db.task.findMany({ where: { campaignId: campaign.id }, orderBy: { createdAt: 'asc' } }).catch(() => [])

  const update = updateCampaign.bind(null, campaign.id)
  const addContent = addCampaignContent.bind(null, campaign.id)
  const addTask = addCampaignTask.bind(null, campaign.id)
  const duplicate = duplicateCampaign.bind(null, campaign.id)
  const published = items.filter((i) => i.status === 'published').length

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}/campaigns`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Campaigns
      </Link>

      <div style={{ marginTop: 8, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: 0 }}>{campaign.name}</h1>
        <form action={duplicate}>
          <button type="submit">Duplicate campaign</button>
        </form>
      </div>

      <form action={update} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 24, alignItems: 'end' }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
          Goal
          <input name="goal" defaultValue={campaign.goal ?? ''} placeholder="One measurable outcome, e.g. 500 new followers in 30 days" style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Name
          <input name="name" defaultValue={campaign.name} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Status
          <select name="status" defaultValue={campaign.status} style={{ width: '100%', marginTop: 4 }}>
            <option value="planning">Planning</option>
            <option value="live">Live</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Starts
          <input type="date" name="startDate" defaultValue={day(campaign.startDate)} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Ends
          <input type="date" name="endDate" defaultValue={day(campaign.endDate)} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <button className="primary" type="submit">Save</button>
      </form>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Content pipeline</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{items.length === 0 ? 'Nothing yet' : `${published} of ${items.length} published`}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
        {STAGES.map((stage, si) => {
          const col = items.filter((i) => i.status === stage.key)
          return (
            <div key={stage.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 10, minHeight: 90 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {stage.label} · {col.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.map((item) => (
                  <div key={item.id} style={{ background: '#fff', color: '#1a1a1a', borderRadius: 6, padding: '8px 10px', fontSize: 12.5, boxShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{item.platform}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {si > 0 && (
                        <form action={setContentStatus.bind(null, item.id, STAGES[si - 1].key)}>
                          <button type="submit" style={smallBtn} aria-label="Move back">←</button>
                        </form>
                      )}
                      {si < STAGES.length - 1 && (
                        <form action={setContentStatus.bind(null, item.id, STAGES[si + 1].key)}>
                          <button type="submit" style={smallBtn} aria-label="Move forward">→ {STAGES[si + 1].label}</button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <form action={addContent} style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        <input name="title" required placeholder="Add a content idea, e.g. Launch teaser reel" style={{ flex: 1, minWidth: 220 }} />
        <select name="platform">
          {PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button className="primary" type="submit">Add idea</button>
      </form>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Tasks</div>
      <div style={{ marginBottom: 10 }}>
        {tasks.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks yet.</div>}
        {tasks.map((t) => {
          const done = t.status === 'done'
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <form action={setCampaignTaskStatus.bind(null, t.id, done ? 'open' : 'done')}>
                <button type="submit" aria-label={done ? 'Mark as not done' : 'Mark as done'} style={{ width: 20, height: 20, padding: 0, borderRadius: 4 }}>{done ? '✓' : ''}</button>
              </form>
              <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : undefined }}>{t.title}</span>
              {t.dueDate && <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{t.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            </div>
          )
        })}
      </div>
      <form action={addTask} style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        <input name="title" required placeholder="Add a task" style={{ flex: 1, minWidth: 220 }} />
        <input type="date" name="dueDate" />
        <button type="submit">Add task</button>
      </form>

      <DeleteCampaignButton campaignId={campaign.id} />
    </div>
  )
}

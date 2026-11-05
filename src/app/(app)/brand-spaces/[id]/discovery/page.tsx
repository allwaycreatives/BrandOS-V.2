import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { discoveryQuestions as defaultQuestions } from '@/lib/discoveryQuestions'

type QuestionLike = { id: string; prompt: string; section?: string }

const when = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function DiscoverySummaryPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace } = access

  // Every round of discovery, newest first. A later custom questionnaire never hides the earlier answers.
  const responses = await db.discoveryResponse
    .findMany({
      where: { brandSpaceId: params.id },
      orderBy: { submittedAt: 'desc' },
      include: { templateVersion: { include: { template: { select: { name: true } } } } },
    })
    .catch(() => [])

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Brand Discovery Summary</div>
        <div className="topbar-sub">Everything provided during discovery, kept here for reference.</div>
      </div>

      {responses.length === 0 ? (
        <div className="card-empty">No discovery responses yet.</div>
      ) : (
        responses.map((response, index) => {
          const answers = (response.answersJson as Record<string, string | string[]>) || {}
          // Use the actual question set that produced this response, so labels are always right.
          const stored = response.templateVersion?.questionsJson as QuestionLike[] | undefined
          const questions: QuestionLike[] = stored && stored.length > 0 ? stored : defaultQuestions
          const round = responses.length - index
          return (
            <section key={response.id} style={{ marginBottom: 36 }}>
              {responses.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    Round {round}
                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {response.templateVersion?.template?.name || 'Discovery'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{when(response.submittedAt)}</div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {questions.map((q) => {
                  const value = answers[q.id]
                  if (!value || (Array.isArray(value) && value.length === 0)) return null
                  return (
                    <div key={q.id} className="card">
                      {q.section && <div style={{ fontSize: 10, color: 'var(--accent-text)', marginBottom: 4 }}>{q.section}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>{q.prompt}</div>
                      {Array.isArray(value) ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {value.map((v) => (
                            <span key={v} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                              {v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{value}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

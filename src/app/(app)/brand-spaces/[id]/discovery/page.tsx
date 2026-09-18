import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { discoveryQuestions as defaultQuestions } from '@/lib/discoveryQuestions'

type QuestionLike = { id: string; prompt: string; section?: string }

export default async function DiscoverySummaryPage({ params }: { params: { id: string } }) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!brandSpace) notFound()

  const response = await db.discoveryResponse
    .findFirst({
      where: { brandSpaceId: params.id },
      orderBy: { submittedAt: 'desc' },
      include: { templateVersion: true },
    })
    .catch(() => null)

  const answers = (response?.answersJson as Record<string, string | string[]>) || {}

  // Use the actual question set that produced this response — the default
  // quiz, or a custom template's own questions — so labels are always
  // correct, even for long-form/custom questionnaires.
  const storedQuestions = response?.templateVersion?.questionsJson as QuestionLike[] | undefined
  const questions: QuestionLike[] =
    storedQuestions && storedQuestions.length > 0 ? storedQuestions : defaultQuestions

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Brand Discovery Summary</div>
        <div className="topbar-sub">Everything provided during discovery, kept here for reference.</div>
      </div>

      {!response ? (
        <div className="card-empty">No discovery responses yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {questions.map((q) => {
            const value = answers[q.id]
            if (!value) return null
            return (
              <div key={q.id} className="card">
                {q.section && (
                  <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 4 }}>{q.section}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
                  {q.prompt}
                </div>
                {Array.isArray(value) ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {value.map((v) => (
                      <span
                        key={v}
                        style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 14 }}>{value}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

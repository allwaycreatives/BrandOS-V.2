import { db } from '@/lib/db'
import DiscoveryForm from './DiscoveryForm'
import LongFormDiscoveryForm from './LongFormDiscoveryForm'

export default async function DiscoveryPage({ params }: { params: { id: string } }) {
  const activeTemplate = await db.discoveryTemplate
    .findFirst({
      where: { brandSpaceId: params.id, isActive: true, format: 'longform' },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    })
    .catch(() => null)

  const longformQuestions = activeTemplate?.versions[0]?.questionsJson as
    | { id: string; section?: string; prompt: string; helper?: string }[]
    | undefined

  return (
    <main style={{ maxWidth: activeTemplate ? 640 : 480, margin: '0 auto', minHeight: '100vh', padding: '3rem 1rem', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/brandos-logo.png" alt="BrandOS" style={{ height: 22, margin: '0 auto' }} />
      </div>
      {activeTemplate && longformQuestions ? (
        <LongFormDiscoveryForm brandSpaceId={params.id} questions={longformQuestions} />
      ) : (
        <DiscoveryForm brandSpaceId={params.id} />
      )}
    </main>
  )
}

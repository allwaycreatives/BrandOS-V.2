import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import TemplateBuilder from './TemplateBuilder'

export default async function TemplatePage({ params }: { params: { id: string } }) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!brandSpace) notFound()

  const activeCustomTemplate = await db.discoveryTemplate
    .findFirst({ where: { brandSpaceId: params.id, isActive: true, format: 'longform' } })
    .catch(() => null)

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Custom Discovery Questionnaire</div>
        <div className="topbar-sub">
          Build a long-form, section-grouped intake form for this brand space — for deep, industry-specific
          discovery that doesn't fit the quick swipeable quiz. This replaces the default quiz on this brand
          space's discovery link.
        </div>
      </div>

      <TemplateBuilder brandSpaceId={params.id} hasActiveCustomTemplate={Boolean(activeCustomTemplate)} />
    </div>
  )
}

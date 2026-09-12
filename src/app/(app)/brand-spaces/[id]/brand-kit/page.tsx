import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import GenerateButton from './GenerateButton'
import OptionButton from './OptionButton'

export default async function BrandKitPage({ params }: { params: { id: string } }) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!brandSpace) notFound()

  const discoveryResponse = await db.discoveryResponse
    .findFirst({ where: { brandSpaceId: params.id } })
    .catch(() => null)

  const items = await db.brandKitItem
    .findMany({ where: { brandSpaceId: params.id }, orderBy: { generatedAt: 'desc' } })
    .catch(() => [])

  const bios = items.filter((i) => i.type === 'bio')
  const taglines = items.filter((i) => i.type === 'tagline')

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Brand Kit</div>
        <div className="topbar-sub">AI-generated options based on the discovery answers. Pick one, or regenerate.</div>
      </div>

      {!discoveryResponse ? (
        <div className="card-empty">
          Complete discovery for this brand space first — Brand Kit needs those answers to work from.
        </div>
      ) : (
        <>
          <GenerateButton brandSpaceId={params.id} />

          {bios.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Bio options</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {bios.map((item) => (
                  <OptionButton
                    key={item.id}
                    brandSpaceId={params.id}
                    itemId={item.id}
                    type="bio"
                    text={(item.contentJson as { text: string }).text}
                    isSelected={item.isSelected}
                  />
                ))}
              </div>
            </div>
          )}

          {taglines.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Tagline options</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {taglines.map((item) => (
                  <OptionButton
                    key={item.id}
                    brandSpaceId={params.id}
                    itemId={item.id}
                    type="tagline"
                    text={(item.contentJson as { text: string }).text}
                    isSelected={item.isSelected}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

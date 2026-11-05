import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import GenerateButton from './GenerateButton'
import OptionButton from './OptionButton'
import PlatformPriority from './PlatformPriority'

function safeContent(contentJson: unknown): { bio: string; tagline: string; profilePicture: string; highlights?: string[] } {
  const obj = (contentJson && typeof contentJson === 'object' ? contentJson : {}) as Record<string, unknown>
  return {
    bio: typeof obj.bio === 'string' ? obj.bio : '',
    tagline: typeof obj.tagline === 'string' ? obj.tagline : '',
    profilePicture: typeof obj.profilePicture === 'string' ? obj.profilePicture : '',
    highlights: Array.isArray(obj.highlights) ? obj.highlights.filter((h): h is string => typeof h === 'string') : undefined,
  }
}

export default async function BrandKitPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role !== 'agency') notFound()
  const { brandSpace } = access

  const discoveryResponse = await db.discoveryResponse
    .findFirst({ where: { brandSpaceId: params.id }, orderBy: { submittedAt: 'desc' } })
    .catch(() => null)

  const items = await db.brandKitItem
    .findMany({ where: { brandSpaceId: params.id, type: 'platform_kit' }, orderBy: { generatedAt: 'desc' } })
    .catch(() => [])

  const answers = (discoveryResponse?.answersJson as Record<string, unknown>) || {}
  const discoveredPlatforms = Array.isArray(answers.platforms) ? (answers.platforms as string[]) : []

  const savedPriority = Array.isArray(brandSpace!.platformPriority) ? (brandSpace!.platformPriority as string[]) : []
  const priorityOrder = savedPriority.length > 0
    ? savedPriority
    : discoveredPlatforms

  const itemsByPlatform = new Map<string, typeof items>()
  for (const item of items) {
    if (!item.platform) continue
    const list = itemsByPlatform.get(item.platform) || []
    list.push(item)
    itemsByPlatform.set(item.platform, list)
  }

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Brand Kit</div>
        <div className="topbar-sub">Per-platform bio, tagline, and profile picture direction. Pick your favorite for each.</div>
      </div>

      {!discoveryResponse ? (
        <div className="card-empty">
          Complete discovery for this brand space first — Brand Kit needs those answers to work from.
        </div>
      ) : (
        <>
          <GenerateButton brandSpaceId={params.id} />

          {priorityOrder.length > 1 && (
            <div style={{ marginTop: 24, maxWidth: 420 }}>
              <PlatformPriority brandSpaceId={params.id} initialOrder={priorityOrder} />
            </div>
          )}

          {priorityOrder.map((platform) => {
            const platformItems = itemsByPlatform.get(platform) || []
            if (platformItems.length === 0) return null

            return (
              <div key={platform} style={{ marginTop: 28 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15 }}>{platform}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 10 }}>
                  {platformItems.map((item) => (
                    <OptionButton
                      key={item.id}
                      brandSpaceId={params.id}
                      itemId={item.id}
                      platform={platform}
                      content={safeContent(item.contentJson)}
                      isSelected={item.isSelected}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {items.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <Link href={`/brand-spaces/${params.id}/calendar`}>
                <button className="primary">Continue to Content Calendar →</button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}

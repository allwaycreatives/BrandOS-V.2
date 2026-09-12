import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { selectBrandKitItem } from './actions'
import GenerateButton from './GenerateButton'

export default async function BrandKitPage({ params }: { params: { id: string } }) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!brandSpace) notFound()

  const discoveryResponse = await db.discoveryResponse.findFirst({ where: { brandSpaceId: params.id } })
  const items = await db.brandKitItem.findMany({
    where: { brandSpaceId: params.id },
    orderBy: { generatedAt: 'desc' },
  })

  const bios = items.filter((i) => i.type === 'bio')
  const taglines = items.filter((i) => i.type === 'tagline')

  function OptionGroup({ title, options, type }: { title: string; options: typeof items; type: string }) {
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>{title}</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {options.map((item) => (
            <form
              key={item.id}
              action={async () => {
                'use server'
                await selectBrandKitItem(params.id, item.id, type)
              }}
            >
              <button
                type="submit"
                className="card"
                style={{
                  textAlign: 'left',
                  width: '100%',
                  borderColor: item.isSelected ? 'var(--accent)' : undefined,
                }}
              >
                {item.isSelected && (
                  <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>SELECTED</span>
                )}
                <div style={{ marginTop: 4 }}>{(item.contentJson as { text: string }).text}</div>
              </button>
            </form>
          ))}
        </div>
      </div>
    )
  }

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
          {bios.length > 0 && <OptionGroup title="Bio options" options={bios} type="bio" />}
          {taglines.length > 0 && <OptionGroup title="Tagline options" options={taglines} type="tagline" />}
        </>
      )}
    </div>
  )
}

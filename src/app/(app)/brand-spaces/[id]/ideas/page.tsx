import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { brandColor } from '@/lib/brandColor'
import IdeaList from '@/components/IdeaList'

export default async function BrandIdeasPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()
  const { brandSpace } = access

  // The company above this brand, if there is one and the person may add ideas to it.
  const parentAccess = brandSpace.parentId ? await assertBrandSpaceAccess(brandSpace.parentId) : null
  const parent = parentAccess && parentAccess.role !== 'client' ? parentAccess.brandSpace : null

  const ideas = await db.idea.findMany({ where: { brandSpaceId: params.id, status: 'open' }, orderBy: { createdAt: 'desc' } }).catch(() => [])

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Ideas</div>
        <div className="topbar-sub">Park ideas for {brandSpace.name}. Turn the good ones into a campaign or project.</div>
      </div>
      <IdeaList ideas={ideas} brands={[
          { id: brandSpace.id, name: brandSpace.name, color: brandColor(brandSpace.name), parentId: parent ? parent.id : null },
          ...(parent ? [{ id: parent.id, name: parent.name, color: brandColor(parent.name) }] : []),
        ]} fixedBrandId={params.id} />
    </div>
  )
}

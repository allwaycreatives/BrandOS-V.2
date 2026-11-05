import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { parseStrategy } from '@/lib/strategy'
import { postFormatSheet, strategyFormatSheet } from '@/lib/importSheets'
import ImportClient from './ImportClient'

export default async function ImportPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  if (access.role === 'client') {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="topbar-greeting">Import</div>
        <div className="card-empty" style={{ marginTop: 16 }}>This page is for the team.</div>
      </div>
    )
  }

  const strategy = parseStrategy(access.brandSpace.strategy)
  const hasNames = strategy.pillars.length + strategy.series.length + strategy.platforms.length > 0
  const kind = searchParams.kind === 'strategy' ? 'strategy' : 'posts'

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href={`/brand-spaces/${params.id}/${kind === 'strategy' ? 'strategy' : 'calendar'}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {kind === 'strategy' ? 'Strategy' : 'Calendar'}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Import from ChatGPT</div>
        <div className="topbar-sub">Let ChatGPT write it in Brand Console format, paste it here, check it, and import. Nothing is created until you press Import.</div>
      </div>
      <ImportClient
        brandSpaceId={params.id}
        initialKind={kind}
        hasNames={hasNames}
        postSheetPlain={postFormatSheet(null)}
        postSheetWithNames={postFormatSheet(strategy)}
        strategySheet={strategyFormatSheet()}
      />
    </div>
  )
}

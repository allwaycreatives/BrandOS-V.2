'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { previewPostImport, commitPostImport, previewStrategyImport, commitStrategyImport, type PreviewPost, type StrategyPreview } from './actions'
import { typeOf } from '@/lib/contentOptions'
import { dayLabel } from '@/lib/plan'

type Kind = 'posts' | 'strategy'

const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0, opacity: 0.6, marginTop: 3 }} aria-hidden="true">
    <path d="M4 1.7h5.2L12.3 5v9.3H4z" strokeLinejoin="round" />
    <path d="M9 1.8V5h3.2M6 8h4.3M6 10.6h4.3" strokeLinecap="round" />
  </svg>
)

export default function ImportClient({
  brandSpaceId,
  initialKind,
  hasNames,
  postSheetPlain,
  postSheetWithNames,
  strategySheet,
}: {
  brandSpaceId: string
  initialKind: Kind
  hasNames: boolean
  postSheetPlain: string
  postSheetWithNames: string
  strategySheet: string
}) {
  const [kind, setKind] = useState<Kind>(initialKind)
  const [withNames, setWithNames] = useState(hasNames)
  const [showSheet, setShowSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const [text, setText] = useState('')
  const [posts, setPosts] = useState<PreviewPost[] | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [stratPreview, setStratPreview] = useState<StrategyPreview | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [status, setStatus] = useState<'idea' | 'planned'>('idea')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sheet = kind === 'strategy' ? strategySheet : withNames ? postSheetWithNames : postSheetPlain

  function reset() {
    setPosts(null)
    setStratPreview(null)
    setProblems([])
    setError(null)
    setDone(null)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(sheet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShowSheet(true)
      setError('Your browser would not copy it. Select the text below and copy it by hand.')
    }
  }

  function check() {
    reset()
    startTransition(async () => {
      try {
        if (kind === 'posts') {
          const res = await previewPostImport(brandSpaceId, text)
          if (!res.ok) return setError(res.error || 'Something went wrong.')
          setPosts(res.posts ?? [])
          setProblems(res.problems ?? [])
          setPicked(new Set((res.posts ?? []).filter((p) => !p.duplicate).map((p) => p.index)))
        } else {
          const res = await previewStrategyImport(brandSpaceId, text)
          if (!res.ok) return setError(res.error || 'Something went wrong.')
          setStratPreview(res.preview ?? null)
        }
      } catch {
        setError('Could not check that. Please try again.')
      }
    })
  }

  function doImport() {
    setError(null)
    startTransition(async () => {
      try {
        if (kind === 'posts') {
          const res = await commitPostImport(brandSpaceId, text, Array.from(picked), status)
          if (!res.ok) return setError(res.error || 'Could not import.')
          setDone(`Imported ${res.created} ${res.created === 1 ? 'post' : 'posts'} as ${status === 'idea' ? 'Ideas (hidden from clients)' : 'Planned'}.`)
        } else {
          const res = await commitStrategyImport(brandSpaceId, text)
          if (!res.ok) return setError(res.error || 'Could not import.')
          setDone('Strategy imported.')
        }
        setPosts(null)
        setStratPreview(null)
        setText('')
      } catch {
        setError('Could not import. Nothing was changed. Please try again.')
      }
    })
  }

  const tab = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-strong)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
    cursor: 'pointer',
  })
  const step = (n: number, title: string) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 600 }}>Step {n}</span>
      <span style={{ fontWeight: 600 }}>{title}</span>
    </div>
  )

  const chosen = posts ? posts.filter((p) => picked.has(p.index)).length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={tab(kind === 'posts')} onClick={() => { setKind('posts'); reset() }}>Posts</button>
        <button type="button" style={tab(kind === 'strategy')} onClick={() => { setKind('strategy'); reset() }}>Strategy</button>
      </div>

      <div className="card">
        {step(1, 'Teach ChatGPT the format (once)')}
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 10 }}>
          Copy this and paste it into ChatGPT once, for example into the project or custom instructions. It only describes the layout. ChatGPT already knows your brand. After that, just ask it for {kind === 'posts' ? 'posts' : 'a strategy'} &quot;in Brand Console format&quot;.
        </div>
        {kind === 'posts' && hasNames && (
          <label style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input type="checkbox" checked={withNames} onChange={(e) => setWithNames(e.target.checked)} />
            Include my pillar, series and platform names, so ChatGPT uses them exactly
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="primary" onClick={copy}>{copied ? 'Copied!' : 'Copy the format'}</button>
          <button type="button" onClick={() => setShowSheet((s) => !s)}>{showSheet ? 'Hide it' : 'Show it'}</button>
        </div>
        {showSheet && <pre style={{ marginTop: 12, padding: 12, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 340, overflow: 'auto' }}>{sheet}</pre>}
      </div>

      <div className="card">
        {step(2, "Paste ChatGPT's answer")}
        <textarea rows={10} value={text} onChange={(e) => { setText(e.target.value); if (posts || stratPreview || done) reset() }} placeholder={kind === 'posts' ? '## First post title\nPlatform: Instagram\n...' : 'Mission: ...\nPillars:\n- ...'} style={{ width: '100%', marginBottom: 10 }} />
        <button type="button" className="primary" onClick={check} disabled={isPending || !text.trim()}>{isPending && !posts && !stratPreview ? 'Checking...' : 'Check it'}</button>
        {error && <div style={{ fontSize: 12.5, color: 'var(--accent-text)', marginTop: 10 }}>{error}</div>}
      </div>

      {done && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{done}</div>
          <Link href={kind === 'posts' ? `/brand-spaces/${brandSpaceId}/calendar` : `/brand-spaces/${brandSpaceId}/strategy`} style={{ fontSize: 13, color: 'var(--accent-text)' }}>
            {kind === 'posts' ? 'Open the calendar →' : 'Open the strategy →'}
          </Link>
        </div>
      )}

      {posts && (
        <div className="card">
          {step(3, 'Check what will be imported')}
          {problems.map((p, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--accent-text)', marginBottom: 6 }}>{p}</div>)}
          {posts.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No posts found. Check that ChatGPT used the format, with each post starting on a line like &quot;## Post title&quot;.</div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                {posts.length} {posts.length === 1 ? 'post' : 'posts'} found. Untick any you do not want.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {posts.map((p) => {
                  const on = picked.has(p.index)
                  const bits = [p.platform, p.contentType ? typeOf(p.contentType)?.label.split(' (')[0] : null, p.pillar, p.publish ? `Publish ${dayLabel(p.publish)}` : null, p.production ? `Shoot ${dayLabel(p.production)}` : null, p.hookCount ? `${p.hookCount} hook options` : null, p.hasBrief ? 'Brief' : null].filter(Boolean)
                  return (
                    <label key={p.index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', border: '1px solid var(--border-strong)', borderRadius: 8, opacity: on ? 1 : 0.55, cursor: 'pointer' }}>
                      <input type="checkbox" checked={on} style={{ marginTop: 3 }} onChange={(e) => setPicked((prev) => { const n = new Set(prev); e.target.checked ? n.add(p.index) : n.delete(p.index); return n })} />
                      <DocIcon />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>{p.title}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>{bits.join(' · ')}</span>
                        {p.duplicate && <span style={{ display: 'block', fontSize: 12, color: 'var(--accent-text)' }}>A post with this title and platform already exists, so it is unticked.</span>}
                        {p.warnings.map((w, i) => <span key={i} style={{ display: 'block', fontSize: 12, color: 'var(--accent-text)' }}>{w}</span>)}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Import them as</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <label style={{ fontSize: 13, display: 'flex', gap: 8 }}><input type="radio" name="status" checked={status === 'idea'} onChange={() => setStatus('idea')} /> Ideas: hidden from clients until you move them to Planned (recommended)</label>
                <label style={{ fontSize: 13, display: 'flex', gap: 8 }}><input type="radio" name="status" checked={status === 'planned'} onChange={() => setStatus('planned')} /> Planned: visible on the client plan right away</label>
              </div>
              <button type="button" className="primary" onClick={doImport} disabled={isPending || chosen === 0}>{isPending ? 'Importing...' : `Import ${chosen} ${chosen === 1 ? 'post' : 'posts'}`}</button>
            </>
          )}
        </div>
      )}

      {stratPreview && (
        <div className="card">
          {step(3, 'Check what will change')}
          {stratPreview.problems.map((p, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--accent-text)', marginBottom: 6 }}>{p}</div>)}
          {stratPreview.lines.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing found to import.</div>
          ) : (
            <>
              <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
                {stratPreview.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Only the sections you pasted change. Everything else on the Strategy page stays as it is.</div>
              <button type="button" className="primary" onClick={doImport} disabled={isPending}>{isPending ? 'Importing...' : 'Import the strategy'}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

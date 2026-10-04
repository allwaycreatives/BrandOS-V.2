'use client'

import { useTransition } from 'react'
import { selectBrandKitItem } from './actions'

type PlatformKitContent = {
  bio: string
  tagline: string
  profilePicture: string
  highlights?: string[]
}

export default function OptionButton({
  brandSpaceId,
  itemId,
  platform,
  content,
  isSelected,
}: {
  brandSpaceId: string
  itemId: string
  platform: string
  content: PlatformKitContent
  isSelected: boolean
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      className="card"
      disabled={isPending}
      style={{
        textAlign: 'left',
        width: '100%',
        borderColor: isSelected ? 'var(--accent)' : undefined,
        opacity: isPending ? 0.6 : 1,
      }}
      onClick={() => startTransition(() => selectBrandKitItem(brandSpaceId, itemId, platform))}
    >
      {isSelected && (
        <span style={{ color: 'var(--accent-text)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          SELECTED
        </span>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Bio
      </div>
      <div style={{ marginBottom: 8, fontSize: 13.5 }}>{content.bio}</div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Tagline / CTA
      </div>
      <div style={{ marginBottom: 8, fontSize: 13.5 }}>{content.tagline}</div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Profile picture direction
      </div>
      <div style={{ marginBottom: content.highlights ? 8 : 0, fontSize: 13.5 }}>{content.profilePicture}</div>

      {content.highlights && content.highlights.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Highlight titles
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {content.highlights.map((h) => (
              <span
                key={h}
                style={{
                  fontSize: 12,
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-secondary)',
                }}
              >
                {h}
              </span>
            ))}
          </div>
        </>
      )}
    </button>
  )
}

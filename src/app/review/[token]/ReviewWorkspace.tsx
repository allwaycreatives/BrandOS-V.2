'use client'

import { useState } from 'react'
import PinnableImage, { type Pin } from '@/components/PinnableImage'
import ReviewForm from './ReviewForm'

// The part of the review page that needs to share state: the image you click to pin,
// the conversation, and the feedback form.
export default function ReviewWorkspace({
  token,
  imageUrl,
  pins,
  preview,
  children,
}: {
  token: string
  imageUrl: string | null
  pins: Pin[]
  preview: React.ReactNode
  children: React.ReactNode
}) {
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
      {imageUrl ? (
        <>
          <PinnableImage src={imageUrl} pins={pins} pending={pending} onPlace={setPending} />
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
            Tip: click anywhere on the image to pin a comment to that exact spot.
          </div>
        </>
      ) : (
        preview
      )}
      {children}
      <ReviewForm token={token} pin={imageUrl ? pending : null} onClearPin={() => setPending(null)} nextPin={pins.length + 1} />
    </>
  )
}

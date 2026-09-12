'use client'

import { useTransition } from 'react'
import { selectBrandKitItem } from './actions'

export default function OptionButton({
  brandSpaceId,
  itemId,
  type,
  text,
  isSelected,
}: {
  brandSpaceId: string
  itemId: string
  type: string
  text: string
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
      onClick={() => startTransition(() => selectBrandKitItem(brandSpaceId, itemId, type))}
    >
      {isSelected && <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>SELECTED</span>}
      <div style={{ marginTop: 4 }}>{text}</div>
    </button>
  )
}

// The little coloured circle next to a brand's name. It always stays a perfect circle of the same size,
// even when the name beside it is long and wraps onto several lines.
export default function BrandDot({ size = 9, color }: { size?: number; color?: string | null }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: size, height: size, minWidth: size, minHeight: size, flex: `0 0 ${size}px`, borderRadius: '50%', background: color || 'var(--text-muted)' }}
    />
  )
}

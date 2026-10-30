// The Brand Console logo. Shows the version that suits the theme: orange + white on dark, orange + black on light.
// "full" is the whole BRAND CONSOLE wordmark, "icon" is the BC monogram.

const SIZES = { full: [1052, 324], icon: [574, 623] } as const

export default function BrandLogo({
  variant = 'full',
  height = 24,
  className = '',
  style,
  alt = 'Brand Console',
}: {
  variant?: 'full' | 'icon'
  height?: number | string
  className?: string
  style?: React.CSSProperties
  alt?: string
}) {
  const [w, h] = SIZES[variant]
  const px = typeof height === 'number' ? `${height}px` : height
  return (
    <span className={`bc-logo ${className}`.trim()} style={{ height: px, ...style }} role="img" aria-label={alt}>
      <img className="bc-on-dark" src={`/brand/${variant}-onDark.png`} alt="" width={w} height={h} draggable={false} />
      <img className="bc-on-light" src={`/brand/${variant}-onLight.png`} alt="" width={w} height={h} draggable={false} />
    </span>
  )
}

// A small animated "BC" that writes itself. Use it wherever something is loading.
export default function BrandLoader({ size = 64, label = 'Loading', className = '' }: { size?: number; label?: string; className?: string }) {
  return (
    <span className={`bc-loader ${className}`.trim()} role="status" aria-label={label} style={{ width: size }}>
      <img className="bc-l-b" src="/brand/icon-b.png" alt="" draggable={false} />
      <img className="bc-l-c bc-on-dark" src="/brand/icon-c-onDark.png" alt="" draggable={false} />
      <img className="bc-l-c bc-on-light" src="/brand/icon-c-onLight.png" alt="" draggable={false} />
    </span>
  )
}

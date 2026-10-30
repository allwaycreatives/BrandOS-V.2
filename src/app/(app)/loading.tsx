import BrandLoader from '@/components/BrandLoader'

// Shown for a moment while a page is loading.
export default function Loading() {
  return (
    <div style={{ minHeight: '55vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <BrandLoader size={58} />
    </div>
  )
}

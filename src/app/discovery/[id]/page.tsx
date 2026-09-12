import DiscoveryForm from './DiscoveryForm'

export default function DiscoveryPage({ params }: { params: { id: string } }) {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1rem', gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/brandos-logo.png" alt="BrandOS" style={{ height: 22, margin: '0 auto' }} />
      </div>
      <DiscoveryForm brandSpaceId={params.id} />
    </main>
  )
}

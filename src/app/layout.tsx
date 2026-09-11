import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BrandOS',
  description: 'The operating system for creators, brands, and the agencies serving them.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

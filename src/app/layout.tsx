import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import SplashScreen from '@/components/SplashScreen'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-poppins' })

export const metadata: Metadata = {
  title: 'BrandOS',
  description: 'The operating system for creators, brands, and the agencies serving them.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <SplashScreen>{children}</SplashScreen>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import SplashScreen from '@/components/SplashScreen'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import OfflineSyncManager from '@/components/OfflineSyncManager'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-poppins' })

export const metadata: Metadata = {
  title: 'BrandOS',
  description: 'The operating system for creators, brands, and the agencies serving them.',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard">
      <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
        <body>
          <ServiceWorkerRegister />
          <OfflineSyncManager />
          <SplashScreen>{children}</SplashScreen>
        </body>
      </html>
    </ClerkProvider>
  )
}

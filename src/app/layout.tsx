import type { Metadata, Viewport } from 'next'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
}

// Sets the saved theme before the page paints, so there is no flash. Dark unless you chose light.
const THEME_SCRIPT = "(function(){try{var t=localStorage.getItem('brandos-theme');if(t!=='light'&&t!=='dark'){t='dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard">
      <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        </head>
        <body>
          <ServiceWorkerRegister />
          <OfflineSyncManager />
          <SplashScreen>{children}</SplashScreen>
        </body>
      </html>
    </ClerkProvider>
  )
}

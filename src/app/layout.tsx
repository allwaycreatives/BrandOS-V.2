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
  description: 'Brand OS helps creatives discover their brand, manage it, and grow it, with every brand, project and task in one simple place.',
  manifest: '/manifest.json',
  // Lets Google Search Console confirm you own this site (needed for the Google sign-in consent screen).
  // Paste the code Search Console gives you into GOOGLE_SITE_VERIFICATION in Vercel, then redeploy.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
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

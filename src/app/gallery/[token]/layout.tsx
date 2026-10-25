import { Cormorant_Garamond } from 'next/font/google'

// An elegant serif for titles, loaded only for client gallery pages.
const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--g-serif', display: 'swap' })

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <div className={serif.variable}>{children}</div>
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/discovery(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/share(.*)',
  '/review/(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/gallery/(.*)',
  '/api/gallery/(.*)',
  '/api/health',
  '/brief/(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/'],
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/discovery(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/share(.*)',
  '/review/(.*)',
  '/gallery/(.*)',
  '/brief/(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect()
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/'],
}

import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Every page here is personal to the signed-in person or to one share link, so nothing is cached between visitors.
// "buildCommand" is the plain Next.js build that the Cloudflare packaging step runs inside itself. Setting it here lets
// "npm run build" be the single command that does everything, without calling itself in a loop.
export default {
  ...defineCloudflareConfig({}),
  buildCommand: 'npx prisma generate && npx next build',
}

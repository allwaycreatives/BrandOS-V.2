import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Every page here is personal to the signed-in person or to one share link, so nothing is cached between visitors.
export default defineCloudflareConfig({})

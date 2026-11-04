# Galleries: photo & video delivery

Deliver full-quality photos and videos (gigabytes) to a client with one private link.
Galleries live inside a brand (Brand → Galleries) and can be tied to a project.

## Delivery types

When you create a delivery you choose what you are sending (and you can switch later under **Cover & welcome message → Delivery type**):

- **Photos & videos**: the gallery grid with sections, favourites, slideshow and "Download all".
- **One video**: a premiere page for a single film. The client sees your name, the title, a large player, a **Download video** button and your thank-you message. Extra cuts (a vertical version, a teaser) appear underneath as "More from this delivery", and any other files (stills, a music licence) appear as downloads. If you upload several videos, the first by file name is the main one (or pick one as the cover). New video deliveries start with the dark "cinema" look.

**Smooth version (video deliveries).** The page serves your file as it is and does not lower the quality by itself, so a big original can buffer on slow Wi-Fi. On a video delivery, use **Smooth version** to add a lighter 1080p MP4 (about 150 to 250 MB). Clients watch the full-quality original first; if it stalls for a few seconds, the page switches them to the smooth copy at the same moment of the film, and remembers that for the rest of their visit. A **Quality** switch lets them choose by hand, and **Download video** always gives the original. The copy is kept next to the original (your Google Drive's previews folder, or Brand Console storage). Removing it makes everyone stream the original.

**Streaming straight from Google Drive (video deliveries).** When a video delivery kept in Google Drive is published, Brand Console shares its video files in your Drive as "anyone with the link" (the link is long and unguessable, and only appears on the delivery page). The viewer's browser then streams and downloads the film directly from Google: it is faster, and it does not depend on Brand Console holding a working Google login at that moment. If that direct route ever fails, the page switches to Google's own video player, shown inside the same page (your title, message and download button stay). The delivery page shows whether sharing worked ("Direct viewing"). This is skipped when the delivery has a **passcode** or an **expiry date**, because those need Brand Console to stay in the middle. Unpublishing or adding a passcode later does not make the Drive files private again; to do that, change the sharing of the file in Google Drive.

Both types share the same storage, passcode, expiry date, readable link and "Let the client download" switch. Type a client name in **Client name** when you create it and the page shows "Prepared for ...".

Note: with downloads turned off the video can still be watched, and the browser's download option is hidden, but a determined person can always capture a video that is being streamed to them.

## Where the files are kept

| | Google Drive (recommended while testing) | Brand Console storage (Vercel Blob) |
|---|---|---|
| Space | The photographer's own Drive (15 GB free, more with Google One) | Vercel plan (Hobby: 1 GB, Pro: 5 GB included) |
| Upload | Browser → Google Drive, in resumable chunks. Never touches Vercel. | Browser → Vercel Blob, multipart. |
| Client downloads | Through Brand Console (`/api/gallery/<token>/file/<id>`). Drive files stay private. | Direct from Vercel Blob. |

A gallery uses Drive if its creator had connected Google Drive when they created it, otherwise Brand Console storage.

## One-time Google setup (about 10 minutes)

1. **Google Cloud Console** → pick or create a project → **APIs & Services → Library** → enable **Google Drive API**.
2. **Google Auth Platform / OAuth consent screen**: User type **External**. App name "Brand Console", support email, developer email.
   Add the scope `https://www.googleapis.com/auth/drive.file` (plus `openid` and `email`).
3. **Publish the app: set the status to "In production".** This is a one-click change and needs no Google review for `drive.file`.
   If you leave it on "Testing", Google expires the connection every 7 days.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   Authorized redirect URIs: `https://YOUR-DOMAIN/api/google/callback` (and `http://localhost:3000/api/google/callback` for local work).
5. In **Vercel → Settings → Environment Variables** add:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - optional `GOOGLE_TOKEN_KEY`: any long random text used to encrypt the saved Google keys. If left out, `CLERK_SECRET_KEY` is used (rotating that key then means reconnecting Drive).
6. Redeploy, open **Brand → Galleries → Connect Google Drive**.

Brand Console only asks for the narrow `drive.file` permission: it can see only the files and folders it creates itself
("Brand Console Galleries" → "<brand> · <gallery>" → "_previews"), never the rest of the Drive.

## Consent screen fields (Google Auth Platform → Branding)

Use your exact site address everywhere (for example `brand-os-v-2.vercel.app`, or a custom domain later), including the
redirect URI above. For "Authorized domains" enter that exact address, not just `vercel.app`. Google may ask you to prove
you own it: in Google Search Console add a URL-prefix property for `https://YOUR-DOMAIN/`, choose the HTML tag method,
copy the `content` value into `GOOGLE_SITE_VERIFICATION` in Vercel, redeploy, then click Verify.

| Field | Value |
|---|---|
| App name | Brand Console |
| Application home page | `https://YOUR-DOMAIN/` |
| Application privacy policy link | `https://YOUR-DOMAIN/privacy` |
| Application terms of service link | `https://YOUR-DOMAIN/terms` |
| Authorized domains | your exact site address, e.g. `brand-os-v-2.vercel.app` (verify in Google Search Console if asked) |
| Developer contact email | an inbox you read |

Skip the app logo for now: adding one can trigger Google's brand verification, which slows publishing.
Also set `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel so the policy pages show your real contact address.

## Good to know

- Big downloads are fetched in 48 MB pieces, so a single file of any size works with "Download all" (zip) and with
  single-file download in Chrome/Edge. In other browsers a very large single file is one long request
  (Vercel free plan allows 5 minutes per request), so for multi-GB files use "Download all" in Chrome/Edge.
- Every download from a Drive gallery passes through Vercel (Hobby plan includes 100 GB/month of transfer).
  Previews are cached at the edge; originals are never cached.
- Drive has its own daily limits; for heavy use later, move to Cloudflare R2 (no download fees).
- Disconnecting Drive stops serving the galleries kept in it (files remain in Drive); reconnecting restores them.

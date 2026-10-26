# Galleries: photo & video delivery

Deliver full-quality photos and videos (gigabytes) to a client with one private link.
Galleries live inside a brand (Brand → Galleries) and can be tied to a project.

## Where the files are kept

| | Google Drive (recommended while testing) | BrandOS storage (Vercel Blob) |
|---|---|---|
| Space | The photographer's own Drive (15 GB free, more with Google One) | Vercel plan (Hobby: 1 GB, Pro: 5 GB included) |
| Upload | Browser → Google Drive, in resumable chunks. Never touches Vercel. | Browser → Vercel Blob, multipart. |
| Client downloads | Through BrandOS (`/api/gallery/<token>/file/<id>`). Drive files stay private. | Direct from Vercel Blob. |

A gallery uses Drive if its creator had connected Google Drive when they created it, otherwise BrandOS storage.

## One-time Google setup (about 10 minutes)

1. **Google Cloud Console** → pick or create a project → **APIs & Services → Library** → enable **Google Drive API**.
2. **Google Auth Platform / OAuth consent screen**: User type **External**. App name "BrandOS", support email, developer email.
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

BrandOS only asks for the narrow `drive.file` permission: it can see only the files and folders it creates itself
("BrandOS Galleries" → "<brand> · <gallery>" → "_previews"), never the rest of the Drive.

## Consent screen fields (Google Auth Platform → Branding)

Use your own domain (Google does not accept `*.vercel.app` as an authorized domain, so attach a custom domain to the
Vercel project first, e.g. `brandos.yourdomain.com`, and use it everywhere, including the redirect URI above).

| Field | Value |
|---|---|
| App name | BrandOS |
| Application home page | `https://YOUR-DOMAIN/` |
| Application privacy policy link | `https://YOUR-DOMAIN/privacy` |
| Application terms of service link | `https://YOUR-DOMAIN/terms` |
| Authorized domains | your root domain, e.g. `yourdomain.com` (verify it in Google Search Console) |
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

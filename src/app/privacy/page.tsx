import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { APP_NAME, COMPANY, CONTACT_EMAIL, GOOGLE_PERMISSIONS_URL, GOOGLE_POLICY_URL } from '@/lib/legal'

export const metadata: Metadata = { title: `Privacy Policy · ${APP_NAME}`, description: `How ${APP_NAME} collects, uses and protects your information, including data from Google Drive.` }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro={`${APP_NAME} helps creatives discover their brand, manage their work and deliver it to clients. This policy explains what information we collect, why, who it is shared with, and the choices you have. We have tried to write it in plain language.`}>
      <h2>1. Who we are</h2>
      <p>{APP_NAME} (previously called BrandOS) is operated by {COMPANY} (“we”, “us”). You can reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for anything about your privacy or your data.</p>

      <h2>2. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account details:</strong> your name and email address, and how you sign in. Sign-in is handled by our authentication provider (Clerk). We never see or store your password.</li>
        <li><strong>Your content:</strong> everything you add to {APP_NAME}: brands, discovery answers, strategy, brand kits, projects, tasks, campaigns, ideas, calendar items, boards, comments, files you attach, and the photos, videos and files you put in client galleries.</li>
        <li><strong>People you invite or share with:</strong> if you invite someone or share a review, brief or gallery, we store their name and email address and what they do there (for example comments and approvals).</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>Basic technical data such as IP address, browser type and the pages requested. This is kept in the logs of our hosting provider for security and to keep the service running.</li>
        <li>Cookies and similar storage described in section 8. We do not use advertising or tracking cookies, and we do not run third-party analytics.</li>
      </ul>
      <h3>Information from Google, if you connect Google Drive</h3>
      <p>This is explained in detail in section 4.</p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To run {APP_NAME}: show you your work, let you share it with the people you choose, and deliver files to your clients.</li>
        <li>To send notifications about activity on your brands, by email if email is switched on for your workspace.</li>
        <li>To provide the AI-assisted features you ask for (section 6).</li>
        <li>To keep the service secure, prevent abuse, fix problems and improve {APP_NAME}.</li>
        <li>To meet legal obligations and to respond to your requests.</li>
      </ul>
      <p><strong>We do not sell your personal information, and we do not use your content to show advertising.</strong></p>

      <h2 id="google">4. Google user data (Google Drive)</h2>
      <p>You can optionally connect your own Google Drive so that the photos and videos in your client galleries are kept in your Drive instead of in our storage. This section describes exactly what we do with Google user data.</p>
      <h3>What we access</h3>
      <ul>
        <li><strong>Your Google account email address,</strong> to show you which account is connected.</li>
        <li><strong>Only the files and folders that {APP_NAME} itself creates in your Drive.</strong> We ask for the narrow <code>drive.file</code> permission, which does not allow us to see, list or read anything else in your Drive. {APP_NAME} creates a folder called “Brand Console Galleries” (connections made before the rename use “BrandOS Galleries”), and inside it a folder for each gallery you create, with a “_previews” sub-folder for small preview copies.</li>
      </ul>
      <h3>Why we use it</h3>
      <ul>
        <li>To upload the files you choose into those folders.</li>
        <li>To read those files and deliver them (and their previews) to the people you share a gallery with, under the rules you set: published or not, passcode, expiry date, and whether downloads are allowed.</li>
        <li>To delete those files when you delete the file or gallery in {APP_NAME}.</li>
      </ul>
      <h3>How we handle it</h3>
      <ul>
        <li>The files stay in your Google Drive and are private to you. We do not make them public.</li>
        <li>When a client views or downloads a file, {APP_NAME} fetches it from your Drive and passes it on to them. We do not keep a copy of the file. Small preview images of galleries without a passcode may be held briefly (up to an hour) by our hosting provider’s network cache so the page loads faster.</li>
        <li>To act on your behalf when you are not online, we store a Google “refresh token”. It is <strong>encrypted at rest</strong> (AES-256-GCM) and only ever used on our servers, never sent to anyone’s browser. Short-lived access tokens (about an hour) are used to talk to Google.</li>
        <li>Your Drive files are <strong>never</strong> sent to AI services, advertisers or data brokers.</li>
      </ul>
      <h3>Limited Use</h3>
      <div className="legal-note">
        <p style={{ margin: 0 }}>{APP_NAME}’s use and transfer to any other app of information received from Google APIs will adhere to the <a href={GOOGLE_POLICY_URL} target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      </div>
      <p>In line with that policy:</p>
      <ul>
        <li>We use Google user data only to provide and improve the user-facing gallery features described above.</li>
        <li>We do not transfer Google user data to others except as needed to provide those features, to comply with the law, or as part of a merger or sale of the business with notice to you.</li>
        <li>We do not use Google user data for serving advertisements, including retargeting or interest-based advertising.</li>
        <li>No human reads Google user data unless you give us explicit permission for specific content, it is necessary for security or to investigate abuse, it is required by law, or the data is aggregated and anonymized for internal operations.</li>
      </ul>
      <h3>Disconnecting and deleting</h3>
      <ul>
        <li>You can disconnect Google Drive at any time from <strong>Brand → Galleries → Disconnect</strong>. We then revoke our access with Google and delete our stored token.</li>
        <li>You can also remove {APP_NAME}’s access yourself at <a href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</li>
        <li>Files already in your Drive stay in your Drive when you disconnect, and you can delete them there. Deleting a gallery in {APP_NAME} deletes its folder and files from your Drive.</li>
      </ul>

      <h2>5. Who we share information with</h2>
      <p>We use trusted companies to run {APP_NAME}. They process information only to provide their service to us:</p>
      <ul>
        <li><strong>Clerk</strong>: sign-in and account management.</li>
        <li><strong>Vercel</strong>: hosting, network delivery, and file storage for galleries that are not kept in Google Drive.</li>
        <li><strong>Our database provider</strong>: a managed PostgreSQL database that stores your account and content.</li>
        <li><strong>Google</strong>: Google Drive, if you connect it, and the Gemini AI service (see section 6).</li>
        <li><strong>Anthropic</strong>: AI service, only if we have switched it on.</li>
        <li><strong>Groq</strong>: speech-to-text for the transcription feature (see section 6).</li>
        <li><strong>Resend</strong>: sending notification emails, if email is switched on.</li>
      </ul>
      <p>We also share information with the people <em>you</em> choose to share with (for example, a client you send a review or gallery link to), and we may disclose information if the law requires it or to protect people and our service from harm.</p>

      <h2>6. AI-assisted features</h2>
      <p>Some features (for example brand discovery summaries, strategy and brand-kit suggestions, and task reviews) send the text you submit in that feature to an AI service to generate a response. By default this is Google’s Gemini; we may use Anthropic’s Claude instead. If you use the transcription features on a task, the audio or video file you attached <em>to that task</em> is sent to Groq for speech-to-text, and the resulting transcript to the AI service.</p>
      <p><strong>Your gallery files and your Google Drive files are never sent to AI services.</strong> AI output can be wrong, so please review it before relying on it.</p>

      <h2>7. Where your information is kept and how long</h2>
      <ul>
        <li>We keep your information while your account is active. When you delete a brand, project, task or gallery, that content is removed from our systems, and for galleries the files are removed from storage or from your Drive. Copies in routine backups may remain for a short period before they are overwritten.</li>
        <li>If you want your account and data deleted, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will act on it within 30 days, except where the law requires us to keep something.</li>
        <li>Our providers may process information in countries other than your own. We choose providers that protect it appropriately.</li>
      </ul>

      <h2 id="cookies">8. Cookies and storage on your device</h2>
      <ul>
        <li><strong>Sign-in cookies</strong> (set by Clerk) keep you signed in. These are essential.</li>
        <li><strong>A preference</strong> remembering your light or dark theme.</li>
        <li><strong>A gallery unlock cookie</strong>, set only if a gallery has a passcode and you enter it. It lasts 30 days.</li>
        <li><strong>Offline storage.</strong> So {APP_NAME} can work without a connection, your browser keeps a copy of pages you visit and small images on your device. This stays on your device and is removed when you clear the site’s data.</li>
      </ul>
      <p>We do not use advertising or cross-site tracking cookies.</p>

      <h2>9. Security</h2>
      <p>We use encryption in transit (HTTPS), access controls so people only see brands they belong to, passcode and expiry protection for galleries, and encryption of stored Google tokens. No system is perfectly secure, so please use a strong, unique password and keep your devices safe. If you believe your account or a gallery link has been exposed, tell us right away.</p>

      <h2>10. Your choices and rights</h2>
      <p>You can view and edit most of your information inside {APP_NAME}. You can ask us to give you a copy of your data, correct it, or delete it. Depending on where you live (for example under data-protection laws in the EU, UK, South Africa or Namibia) you may have further rights, such as objecting to certain processing. Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will respond within a reasonable time. You may also complain to your local data-protection authority.</p>

      <h2>11. Children</h2>
      <p>{APP_NAME} is not meant for children under 16, and we do not knowingly collect information from them. If you think a child has given us information, tell us and we will delete it.</p>

      <h2>12. Changes to this policy</h2>
      <p>We may update this policy as {APP_NAME} grows. When we make important changes we will update the date at the top and, where appropriate, tell you in the app or by email.</p>

      <h2>13. Contact</h2>
      <p>{COMPANY}<br />Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  )
}

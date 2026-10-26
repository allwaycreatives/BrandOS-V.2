import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { APP_NAME, COMPANY, CONTACT_EMAIL, GOVERNING_LAW } from '@/lib/legal'

export const metadata: Metadata = { title: `Terms of Service · ${APP_NAME}`, description: `The rules for using ${APP_NAME}.` }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro={`These terms are the agreement between you and ${COMPANY} about using ${APP_NAME}. Please read them. By creating an account or using ${APP_NAME} you agree to them.`}>
      <h2>1. Who can use {APP_NAME}</h2>
      <p>You must be old enough to form a binding contract where you live (and at least 16). If you use {APP_NAME} for a business or on behalf of someone else, you confirm you have the authority to accept these terms for them.</p>

      <h2>2. The service</h2>
      <p>{APP_NAME} is a workspace for creatives to discover and manage their brands, run projects, tasks and campaigns, get client reviews and approvals, and deliver photos and videos to clients through private gallery links. {APP_NAME} is still being improved: features may change, and some may be experimental. We work hard to keep it reliable but cannot promise it will always be available or error-free.</p>

      <h2>3. Your account</h2>
      <p>Keep your sign-in details safe and do not share your account. You are responsible for what happens under your account. Tell us promptly if you think it has been compromised. Give us accurate information.</p>

      <h2>4. Your content</h2>
      <ul>
        <li><strong>It stays yours.</strong> You own what you put into {APP_NAME}, including your photos, videos and files. We do not claim ownership.</li>
        <li><strong>What we need from you.</strong> You give us permission to store, process, display and transmit your content only as needed to run the service for you, including delivering it to the people you share it with.</li>
        <li><strong>Your responsibility.</strong> You promise you have the rights and permissions for everything you upload and share, including the consent of people who appear in your photos and videos where the law requires it, and the rights to any music, artwork or other material in them.</li>
        <li><strong>Keep your own backups.</strong> Keep a copy of your original files elsewhere. {APP_NAME} is a delivery and management tool, not a backup service.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>Do not use {APP_NAME} to:</p>
      <ul>
        <li>break the law, or upload or share anything unlawful, defamatory, hateful, harassing or that infringes someone else’s rights;</li>
        <li><strong>store or share child sexual abuse material, or any sexual content involving minors.</strong> We have zero tolerance, will remove it, and will report it to the authorities;</li>
        <li>spread malware, or try to break, probe or overload the service or get around its limits or security;</li>
        <li>send spam, or use {APP_NAME} as a general-purpose public file host or to distribute content to the public at scale;</li>
        <li>copy, resell or reverse-engineer the service except where the law allows.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>6. Galleries and client delivery</h2>
      <ul>
        <li>You decide who receives a gallery link and whether it has a passcode, an expiry date, and downloads on or off. Anyone with the link (and passcode, if set) can see the gallery, so share it carefully.</li>
        <li>Turning downloads off hides the download buttons. It cannot stop someone from taking a screenshot or recording their screen.</li>
        <li>What your clients do with files you deliver is between you and them. We are not responsible for it.</li>
        <li>Large files can take time to deliver and are subject to the limits of the services involved.</li>
      </ul>

      <h2>7. Third-party services, including Google Drive</h2>
      <p>{APP_NAME} works with other services, such as Google Drive, our sign-in provider, our hosting provider and AI services. Your use of them may also be subject to their own terms. If you connect Google Drive, your files are stored in your own Drive and count against your Google storage. If you disconnect it, or Google withdraws access, galleries kept in that Drive stop working until it is reconnected. We are not responsible for outages or changes in third-party services.</p>

      <h2>8. AI-assisted features</h2>
      <p>AI features produce suggestions that may be inaccurate, incomplete or unsuitable. Review them before you use or rely on them. You are responsible for how you use the output.</p>

      <h2>9. Cost</h2>
      <p>{APP_NAME} is currently offered free while we test and improve it. If we introduce paid plans we will tell you in advance and you will not be charged without agreeing to it.</p>

      <h2>10. Our rights</h2>
      <p>{APP_NAME}, including its software, design and branding, belongs to {COMPANY} and our licensors. We give you a personal, limited, non-exclusive right to use it as these terms allow. If you send us feedback or ideas, we may use them without obligation to you.</p>

      <h2>11. Ending your use</h2>
      <p>You can stop using {APP_NAME} at any time and can delete your content or ask us to delete your account (see our <a href="/privacy">Privacy Policy</a>). We may suspend or end access if you break these terms, if we must by law, or to protect {APP_NAME} or other people. We may also stop offering the service, and will try to give you notice and time to take your content.</p>

      <h2>12. No warranty</h2>
      <p>To the fullest extent the law allows, {APP_NAME} is provided “as is” and “as available”, without promises of any kind, express or implied, including about fitness for a particular purpose, uninterrupted or error-free operation, or that content will never be lost.</p>

      <h2>13. Limit on our liability</h2>
      <p>To the fullest extent the law allows, {COMPANY} is not liable for indirect, incidental, special or consequential losses, or for lost profits, data or business, arising from your use of {APP_NAME}. Our total liability for any claim relating to the service is limited to the amount you paid us for it in the 12 months before the claim, or, if you paid nothing, to 100 US dollars. Nothing in these terms limits liability that cannot be limited by law.</p>

      <h2>14. If a claim is made because of you</h2>
      <p>If someone makes a claim against us because of content you uploaded or shared, or because you broke these terms, you agree to cover the reasonable costs and losses that result, to the extent the law allows.</p>

      <h2>15. Changes to these terms</h2>
      <p>We may update these terms. We will change the date at the top and, for important changes, tell you in the app or by email. If you keep using {APP_NAME} after a change takes effect, you accept the new terms.</p>

      <h2>16. Governing law</h2>
      <p>These terms are governed by {GOVERNING_LAW}, and any dispute will be handled by the courts there, unless the law where you live gives you rights that cannot be waived.</p>

      <h2>17. Contact</h2>
      <p>{COMPANY}<br />Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  )
}

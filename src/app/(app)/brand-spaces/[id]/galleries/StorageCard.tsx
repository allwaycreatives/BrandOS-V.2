'use client'

import { useTransition } from 'react'
import { disconnectGoogleDrive } from './actions'

const NOTES: Record<string, string> = {
  connected: 'Google Drive is connected. New galleries will keep their files in your Drive.',
  denied: 'Google Drive was not connected (the permission was not given).',
  error: 'Something went wrong connecting Google Drive. Please try again.',
  notconfigured: 'Google Drive is not set up for this app yet.',
}

export default function StorageCard({ configured, email, returnTo, flag }: { configured: boolean; email: string | null; returnTo: string; flag?: string }) {
  const [pending, start] = useTransition()
  const note = flag ? NOTES[flag] : ''
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Where your files are kept</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
            {email
              ? <>Your Google Drive ({email}). Your clients download from Brand Console; the files stay private in your Drive.</>
              : configured
                ? <>Connect Google Drive to keep delivery files in your own Drive (15 GB free) instead of Brand Console storage.</>
                : <>Brand Console storage. Google Drive isn’t set up for this app yet.</>}
          </div>
        </div>
        {email ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={`/api/google/connect?returnTo=${encodeURIComponent(returnTo)}`} style={{ fontSize: 13, textDecoration: 'underline' }} title="Sign in to Google again. Everything stays linked; use this if Drive stops working.">Reconnect</a>
            <button type="button" disabled={pending} onClick={() => { if (confirm('Disconnect Google Drive? Galleries kept in your Drive stop working until you connect it again. Your files stay in Drive.')) start(async () => { await disconnectGoogleDrive() }) }}>
              {pending ? '…' : 'Disconnect'}
            </button>
          </div>
        ) : configured ? (
          <a className="primary" href={`/api/google/connect?returnTo=${encodeURIComponent(returnTo)}`} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13 }}>Connect Google Drive</a>
        ) : null}
      </div>
      {note && <div style={{ fontSize: 12.5, marginTop: 8, color: flag === 'connected' ? 'var(--accent-text)' : 'var(--text-secondary)' }}>{note}</div>}
    </div>
  )
}

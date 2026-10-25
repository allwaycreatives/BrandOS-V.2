'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unlockGallery } from './actions'

export default function PasscodeForm({ token }: { token: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const [pending, start] = useTransition()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setWrong(false)
        start(async () => {
          const r = await unlockGallery(token, code)
          if (r.ok) router.refresh()
          else setWrong(true)
        })
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}
    >
      <input className="g-input" type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passcode" aria-label="Passcode" />
      <button className="g-btn" type="submit" disabled={pending || !code.trim()}>{pending ? 'Checking…' : 'Open gallery'}</button>
      {wrong && <div style={{ fontSize: 13, color: '#b0413e' }}>That passcode is not right.</div>}
    </form>
  )
}

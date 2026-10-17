'use client'

import { useCallback, useRef, useState } from 'react'
import type { UploadView } from '@/components/UploadBar'
import { friendlyUploadError, isImageFile, uploadFile, type UploadResult } from '@/lib/uploadFile'

// For forms with a single upload field: gives you the progress state to render with <UploadBar />,
// plus run / retry / cancel / dismiss. `run` resolves with the uploaded file, or null if it failed or was cancelled.
export function useFileUpload(opts: { compress?: boolean } = {}) {
  const [item, setItem] = useState<UploadView | null>(null)
  const controller = useRef<AbortController | null>(null)
  const lastFile = useRef<File | null>(null)
  const compress = opts.compress

  const run = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      lastFile.current = file
      controller.current?.abort()
      const c = new AbortController()
      controller.current = c
      setItem({ name: file.name, percent: 0, status: compress !== false && isImageFile(file) ? 'preparing' : 'uploading' })
      try {
        const res = await uploadFile(file, {
          signal: c.signal,
          compress,
          onProgress: (percent, phase) => setItem((prev) => (prev && !c.signal.aborted ? { ...prev, percent, status: phase } : prev)),
        })
        setItem({ name: res.name, percent: 100, status: 'done' })
        return res
      } catch (err) {
        if (c.signal.aborted) {
          setItem(null)
          return null
        }
        setItem({ name: file.name, percent: 0, status: 'error', error: friendlyUploadError(err).message })
        return null
      }
    },
    [compress],
  )

  const retry = useCallback(() => (lastFile.current ? run(lastFile.current) : Promise.resolve(null)), [run])
  const cancel = useCallback(() => controller.current?.abort(), [])
  const dismiss = useCallback(() => setItem(null), [])
  const uploading = !!item && (item.status === 'preparing' || item.status === 'uploading' || item.status === 'retrying')

  return { item, uploading, run, retry, cancel, dismiss }
}

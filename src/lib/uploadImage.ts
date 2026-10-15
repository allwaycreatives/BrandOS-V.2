import { upload } from '@vercel/blob/client'

// ONE place for "put a picture on the internet and give me its address".
// The board (and anything else that uploads pictures) calls this and nothing else, so the way pictures are
// uploaded can be improved here without touching the screens that use it.
//
// onProgress: called as the upload moves along. percent is 0 to 100, or null when it cannot be measured.
// signal: lets the person press Cancel.
export type UploadProgress = { percent: number | null; stage: string }

export async function uploadImage(file: File, opts: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal } = {}): Promise<{ url: string }> {
  opts.onProgress?.({ percent: null, stage: 'Uploading' })
  const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload', abortSignal: opts.signal })
  return { url: blob.url }
}

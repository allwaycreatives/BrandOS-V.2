// Download big files in pieces. Each piece is its own short request, so a slow connection never runs into
// the time limit for a single request, and a hiccup only repeats one piece instead of the whole file.

export const DOWNLOAD_PIECE = 48 * 1024 * 1024

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function rangedStream(url: string, size: number, opts: { piece?: number; tries?: number } = {}): ReadableStream<Uint8Array> {
  const piece = opts.piece ?? DOWNLOAD_PIECE
  const tries = opts.tries ?? 6
  let offset = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= size) {
        controller.close()
        return
      }
      const last = Math.min(offset + piece, size) - 1
      let lastError: unknown
      for (let attempt = 0; attempt < tries; attempt++) {
        try {
          const res = await fetch(url, { headers: { Range: `bytes=${offset}-${last}` } })
          if (res.status !== 206 && !(res.status === 200 && offset === 0 && last === size - 1)) throw new Error(`Download failed (${res.status})`)
          const buf = new Uint8Array(await res.arrayBuffer())
          if (buf.length !== last - offset + 1) throw new Error('The download came back short')
          offset = last + 1
          controller.enqueue(buf)
          return
        } catch (e) {
          lastError = e
          await wait(Math.min(8000, 600 * 2 ** attempt))
        }
      }
      controller.error(lastError instanceof Error ? lastError : new Error('Download failed'))
    },
  })
}

type Writable = { write: (c: Uint8Array) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }
type Picker = (o: unknown) => Promise<{ createWritable: () => Promise<Writable> }>

export const canSaveToDisk = () => typeof window !== 'undefined' && typeof (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker === 'function'

/** Saves one big file straight to disk in pieces (Chrome, Edge). Returns false if the person cancelled the save window. */
export async function saveLargeFile(url: string, size: number, name: string, onBytes?: (n: number) => void): Promise<boolean> {
  const picker = (window as unknown as { showSaveFilePicker: Picker }).showSaveFilePicker
  let writable: Writable
  try {
    const handle = await picker({ suggestedName: name })
    writable = await handle.createWritable()
  } catch {
    return false
  }
  try {
    const reader = rangedStream(url, size).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      onBytes?.(value.length)
    }
    await writable.close()
    return true
  } catch (e) {
    try {
      await writable.abort?.()
    } catch {}
    throw e
  }
}

// Free tier via Groq — no credit card required.
// Get a key at https://console.groq.com/keys
export async function transcribeAudio(fileUrl: string): Promise<string> {
  const fileResponse = await fetch(fileUrl)
  if (!fileResponse.ok) {
    throw new Error(`Could not fetch the file to transcribe it (${fileResponse.status})`)
  }
  const blob = await fileResponse.blob()

  const formData = new FormData()
  formData.append('file', blob, 'upload')
  formData.append('model', 'whisper-large-v3-turbo')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}` },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Groq transcription error (${response.status}): ${text}`)
  }

  const data = await response.json()
  return data.text ?? ''
}

export type TranscriptSegment = { start: number; end: number; text: string }

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Same idea as transcribeAudio, but requests per-segment timestamps —
// needed for clip suggestions to point at an exact moment, not just say
// "somewhere in the middle."
export async function transcribeWithSegments(
  fileUrl: string
): Promise<{ text: string; segments: TranscriptSegment[] }> {
  const fileResponse = await fetch(fileUrl)
  if (!fileResponse.ok) {
    throw new Error(`Could not fetch the file to transcribe it (${fileResponse.status})`)
  }
  const blob = await fileResponse.blob()

  const formData = new FormData()
  formData.append('file', blob, 'upload')
  formData.append('model', 'whisper-large-v3-turbo')
  formData.append('response_format', 'verbose_json')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}` },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Groq transcription error (${response.status}): ${text}`)
  }

  const data = await response.json()
  const segments: TranscriptSegment[] = Array.isArray(data.segments)
    ? data.segments.map((s: { start: number; end: number; text: string }) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      }))
    : []

  return { text: data.text ?? '', segments }
}

export { formatTimestamp }

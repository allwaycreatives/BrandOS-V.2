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

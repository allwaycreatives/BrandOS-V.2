// Free tier via Google AI Studio — no credit card required.
// Get a key at https://aistudio.google.com/apikey
export async function generateTextGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || ''
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${text}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

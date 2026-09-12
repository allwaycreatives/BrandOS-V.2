// Server-side only — never import this from a client component, since it
// uses the secret ANTHROPIC_API_KEY.
export async function generateText(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${text}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((block: { type: string }) => block.type === 'text')
  return textBlock?.text ?? ''
}

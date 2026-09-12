import { generateText as generateTextAnthropic } from './anthropic'
import { generateTextGemini } from './gemini'

// Defaults to the free Gemini tier. To upgrade to Claude for better
// responses later, set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY in
// Vercel's environment variables — no code changes needed.
export async function generateText(prompt: string): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'gemini'

  if (provider === 'anthropic') {
    return generateTextAnthropic(prompt)
  }
  return generateTextGemini(prompt)
}

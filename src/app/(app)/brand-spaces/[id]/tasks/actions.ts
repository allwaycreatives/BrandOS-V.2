'use server'

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { transcribeAudio, transcribeWithSegments, formatTimestamp } from '@/lib/groq'
import { generateText } from '@/lib/ai'
import { revalidatePath } from 'next/cache'

export async function createTask(brandSpaceId: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  if (!title) return

  const description = String(formData.get('description') || '').trim() || null
  const fileUrl = String(formData.get('fileUrl') || '').trim() || String(formData.get('fileLinkFallback') || '').trim() || null
  const audioUrl = String(formData.get('audioUrl') || '').trim() || null
  const assigneeUserId = String(formData.get('assigneeUserId') || '').trim() || null

  await db.task.create({
    data: { brandSpaceId, title, description, fileUrl, audioUrl, assigneeUserId, status: 'open' },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

export async function updateTaskStatus(brandSpaceId: string, taskId: string, status: string) {
  await db.task.update({ where: { id: taskId }, data: { status } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

export async function addTaskComment(brandSpaceId: string, taskId: string, body: string) {
  const { user } = await getOrCreateCurrentUser()
  if (!body.trim()) return

  await db.comment.create({
    data: { brandSpaceId, objectType: 'task', objectId: taskId, authorUserId: user.id, body: body.trim() },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

export async function transcribeAndReview(brandSpaceId: string, taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } })
  const sourceUrl = task?.audioUrl || task?.fileUrl
  if (!sourceUrl) {
    throw new Error("This task doesn't have a file attached to transcribe.")
  }

  const transcript = await transcribeAudio(sourceUrl)

  const prompt = `You're reviewing a short-form video transcript for a content creator. Transcript:

"""
${transcript}
"""

Give short, practical feedback:
1. Rate the hook (the first 1-2 sentences) — does it stop the scroll? If it's weak, suggest a stronger one.
2. Comment briefly on structure/pacing.
3. One specific, actionable change for the next version.

Keep it under 150 words. Direct and practical, no fluff, no generic praise.`

  const feedback = await generateText(prompt)

  await db.task.update({ where: { id: taskId }, data: { transcript, aiFeedback: feedback } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

export async function suggestClips(brandSpaceId: string, taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } })
  const sourceUrl = task?.audioUrl || task?.fileUrl
  if (!sourceUrl) {
    throw new Error("This task doesn't have a file attached to find clips in.")
  }

  const { text, segments } = await transcribeWithSegments(sourceUrl)

  if (segments.length === 0) {
    throw new Error("Couldn't get timestamped segments for this file — try again, or use a different file.")
  }

  const segmentList = segments
    .map((s) => `[${formatTimestamp(s.start)}–${formatTimestamp(s.end)}] ${s.text.trim()}`)
    .join('\n')

  const prompt = `This is a timestamped transcript of a long-form video. Find the 2-4 strongest standalone moments that would make compelling short-form clips (Reels/TikTok/Shorts) on their own — a strong hook, a punchy insight, a surprising or emotional moment.

Transcript with timestamps:
${segmentList}

Return ONLY valid JSON, no other text, in exactly this shape:
{"clips": [{"startTime": "0:45", "endTime": "1:12", "reason": "why this moment works as a standalone clip, under 20 words", "quote": "the actual line(s) from the transcript"}]}

Use the exact timestamps from the transcript above — don't invent times that aren't shown.`

  const raw = await generateText(prompt)
  const cleaned = raw.replace(/```json|```/g, '').trim()

  let parsed: { clips?: unknown[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`AI response wasn't valid JSON. Raw response: ${raw.slice(0, 300)}`)
  }

  const clips = Array.isArray(parsed.clips) ? parsed.clips : []
  if (clips.length === 0) {
    throw new Error("The AI didn't return any clip suggestions — try again.")
  }

  await db.task.update({
    where: { id: taskId },
    data: { transcript: task?.transcript || text, clipSuggestions: clips as unknown as Prisma.InputJsonValue },
  })
  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

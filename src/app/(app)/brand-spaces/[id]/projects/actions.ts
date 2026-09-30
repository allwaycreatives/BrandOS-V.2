'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { PROJECT_STAGES } from './constants'

async function requireEdit(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have permission to change projects here.')
}

async function projectForEdit(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('Project not found.')
  await requireEdit(project.brandSpaceId)
  return project
}

function refresh(brandSpaceId: string, projectId?: string | null) {
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  revalidatePath('/tasks')
  revalidatePath(`/brand-spaces/${brandSpaceId}/projects`)
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
  if (projectId) revalidatePath(`/brand-spaces/${brandSpaceId}/projects/${projectId}`)
}

export async function createProject(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const brandSpaceId = String(formData.get('brandSpaceId') || '')
  if (!name || !brandSpaceId) return
  await requireEdit(brandSpaceId)
  const project = await db.project.create({
    data: { brandSpaceId, name, description: String(formData.get('description') || '').trim() || null },
  })
  refresh(brandSpaceId)
  redirect(`/brand-spaces/${brandSpaceId}/projects/${project.id}`)
}

export async function updateProject(projectId: string, formData: FormData) {
  const project = await projectForEdit(projectId)
  const name = String(formData.get('name') || '').trim()
  const status = String(formData.get('status') || 'brief')
  const due = String(formData.get('dueDate') || '')
  await db.project.update({
    where: { id: projectId },
    data: {
      name: name || project.name,
      description: String(formData.get('description') || '').trim() || null,
      status: PROJECT_STAGES.some((s) => s.key === status) ? status : 'brief',
      dueDate: due ? new Date(due) : null,
    },
  })
  refresh(project.brandSpaceId, projectId)
}

export async function setProjectStatus(projectId: string, status: string) {
  if (!PROJECT_STAGES.some((s) => s.key === status)) return
  const project = await projectForEdit(projectId)
  await db.project.update({ where: { id: projectId }, data: { status } })
  refresh(project.brandSpaceId, projectId)
}

export async function addProjectTask(projectId: string, formData: FormData) {
  const project = await projectForEdit(projectId)
  const title = String(formData.get('title') || '').trim()
  if (!title) return
  const due = String(formData.get('dueDate') || '')
  await db.task.create({
    data: { brandSpaceId: project.brandSpaceId, projectId, title, status: 'open', dueDate: due ? new Date(due) : null },
  })
  refresh(project.brandSpaceId, projectId)
}

export async function setProjectTaskStatus(taskId: string, status: 'open' | 'done') {
  if (status !== 'open' && status !== 'done') return
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) return
  await requireEdit(task.brandSpaceId)
  await db.task.update({ where: { id: taskId }, data: { status } })
  refresh(task.brandSpaceId, task.projectId)
}

// A project's boards (shot list, mood, references) live with it.
export async function addProjectBoard(projectId: string, formData: FormData) {
  const project = await projectForEdit(projectId)
  const name = String(formData.get('name') || '').trim()
  if (!name) return
  const board = await db.board.create({ data: { brandSpaceId: project.brandSpaceId, projectId, name } })
  refresh(project.brandSpaceId, projectId)
  redirect(`/brand-spaces/${project.brandSpaceId}/boards/${board.id}`)
}

// Copies the setup, not the progress: back to Brief, tasks reopened, boards copied with their cards.
export async function duplicateProject(projectId: string) {
  const project = await projectForEdit(projectId)
  const tasks = await db.task.findMany({ where: { projectId } })
  const boards = await db.board.findMany({ where: { projectId }, include: { cards: true } })
  const copy = await db.project.create({
    data: {
      brandSpaceId: project.brandSpaceId,
      name: `${project.name} (copy)`,
      description: project.description,
      tasks: { create: tasks.map((t) => ({ brandSpaceId: project.brandSpaceId, title: t.title, description: t.description, status: 'open' })) },
      boards: {
        create: boards.map((b) => ({
          brandSpaceId: project.brandSpaceId,
          name: b.name,
          cards: { create: b.cards.map((c) => ({ type: c.type, content: c.content, positionX: c.positionX, positionY: c.positionY })) },
        })),
      },
    },
  })
  refresh(project.brandSpaceId)
  redirect(`/brand-spaces/${project.brandSpaceId}/projects/${copy.id}`)
}

// Tasks and boards stay (they just stop belonging to the project).
export async function deleteProject(projectId: string) {
  const project = await projectForEdit(projectId)
  await db.project.delete({ where: { id: projectId } })
  refresh(project.brandSpaceId)
  redirect(`/brand-spaces/${project.brandSpaceId}/projects`)
}

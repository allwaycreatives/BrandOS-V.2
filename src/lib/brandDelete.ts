import { db } from './db'

// Everything that would disappear if this brand were deleted, in plain numbers.
// The delete action walks through the same list, so what the owner sees is what gets removed.
export async function getDeleteSummary(brandSpaceId: string) {
  const bs = { brandSpaceId }
  const [boards, boardCards, projects, campaigns, tasks, contentItems, postFeedback, ideas, deliverables, feedback, discoveryAnswers, discoveryTemplates, brandKitItems, hasProfile, people, invites, comments, notifications, faces, unlinked] =
    await Promise.all([
      db.board.count({ where: bs }),
      db.boardCard.count({ where: { board: bs } }),
      db.project.count({ where: bs }),
      db.campaign.count({ where: bs }),
      db.task.count({ where: bs }),
      db.calendarItem.count({ where: bs }),
      db.calendarItemFeedback.count({ where: { item: bs } }),
      db.idea.count({ where: bs }),
      db.deliverable.count({ where: bs }),
      db.deliverableFeedback.count({ where: { deliverable: bs } }),
      db.discoveryResponse.count({ where: bs }),
      db.discoveryTemplate.count({ where: bs }),
      db.brandKitItem.count({ where: bs }),
      db.brandProfile.count({ where: bs }),
      db.brandSpaceAccess.count({ where: bs }),
      db.brandSpaceInvite.count({ where: bs }),
      db.comment.count({ where: bs }),
      db.notification.count({ where: bs }),
      db.brandFace.count({ where: bs }),
      db.brandSpace.findMany({ where: { parentId: brandSpaceId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ])

  return {
    boards, boardCards, projects, campaigns, tasks, contentItems, postFeedback, ideas, deliverables, feedback,
    discoveryAnswers, discoveryTemplates, brandKitItems, hasProfile: hasProfile > 0, people, invites,
    comments, notifications, faces,
    // Personal brands under this one are NOT deleted. They are unlinked and stay as they are.
    unlinked,
  }
}

export type DeleteSummary = Awaited<ReturnType<typeof getDeleteSummary>>

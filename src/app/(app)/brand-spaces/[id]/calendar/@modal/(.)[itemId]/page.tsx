import PostModal from '@/components/PostModal'
import PostView from '../../[itemId]/PostView'

export default function PostPanel({ params }: { params: { id: string; itemId: string } }) {
  return (
    <PostModal>
      <PostView brandSpaceId={params.id} itemId={params.itemId} />
    </PostModal>
  )
}

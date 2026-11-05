import PostModal from '@/components/PostModal'
import PostView from '../../[itemId]/PostView'

export default async function PostPanel(props: { params: Promise<{ id: string; itemId: string }> }) {
  const params = await props.params;
  return (
    <PostModal>
      <PostView brandSpaceId={params.id} itemId={params.itemId} />
    </PostModal>
  )
}

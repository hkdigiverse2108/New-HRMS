import { createFileRoute } from '@tanstack/react-router'
import { RecycleBin } from '@/components/admin/RecycleBin'

export const Route = createFileRoute('/recycle-bin')({
  component: RecycleBin,
})

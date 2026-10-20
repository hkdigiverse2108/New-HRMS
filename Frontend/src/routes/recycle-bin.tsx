import { createFileRoute } from '@tanstack/react-router'
import { Index } from './index'

// Rendered through the app shell (sidebar, padding) like every other page; Index picks RecycleBin by path.
export const Route = createFileRoute('/recycle-bin')({
  component: Index,
})

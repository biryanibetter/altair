import { createReadHandler } from '@altair/backend'
import { authenticatedReader } from '../../../../lib/backend/read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = createReadHandler('transport', authenticatedReader)

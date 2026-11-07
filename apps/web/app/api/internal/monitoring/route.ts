import 'server-only'
import { createMonitoringSchedulerHandler, runMonitoring } from '@altair/backend'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) { return createMonitoringSchedulerHandler(process.env.INGESTION_SECRET, runMonitoring)(request) }

import { createHash } from 'node:crypto'
import { observationSchema, type JobId, type Observation } from '@altair/shared/contracts'

export interface Batch { observations: Observation[]; nextCursor: number; coverage: string }
export interface ProviderJob {
  id: JobId
  ttlMs: number
  request: (cursor: number) => { url: string; headers?: Record<string, string> }
  normalize: (payload: unknown, now: Date, cursor?: number) => Batch
  collect?: () => Promise<unknown>
}
export type Env = Record<string, string | undefined>
export const sources = {
  'qatar-open-data': { id: '00000000-0000-4000-8000-000000000001', name: 'Qatar Open Data', url: 'https://www.data.gov.qa', license: 'CC BY (Qatar Open Data)' },
  'un-comtrade': { id: '00000000-0000-4000-8000-000000000002', name: 'UN Comtrade', url: 'https://comtradeplus.un.org', license: 'UN Comtrade terms of use' },
  'open-meteo': { id: '00000000-0000-4000-8000-000000000003', name: 'Open-Meteo', url: 'https://open-meteo.com', license: 'CC BY 4.0; Open-Meteo' },
  gdelt: { id: '00000000-0000-4000-8000-000000000004', name: 'GDELT Project', url: 'https://www.gdeltproject.org', license: 'GDELT metadata; publisher rights retained' },
  opensky: { id: '00000000-0000-4000-8000-000000000005', name: 'OpenSky Network', url: 'https://opensky-network.org', license: 'OpenSky Network API terms; review usage authorization' },
  here: { id: '00000000-0000-4000-8000-000000000006', name: 'HERE Traffic', url: 'https://traffic.hereapi.com', license: 'HERE subscription terms; authorized use only' },
  aisstream: { id: '00000000-0000-4000-8000-000000000007', name: 'AISStream', url: 'https://aisstream.io', license: 'AISStream API terms; authorized use only' },
  'authorized-webcam': { id: '00000000-0000-4000-8000-000000000008', name: 'Authorized public webcams', url: 'https://altair.invalid', license: 'Per-feed reviewed license; no default camera access' },
} as const
export const key = (...parts: unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex')
export function observation(job: JobId, provider: Observation['provider'], sourceUrl: string, nature: Observation['nature'], observedAt: string, now: Date, ttlMs: number, recordKey: string, data: Observation['data']): Observation {
  return observationSchema.parse({ job, provider, recordKey, sourceId: sources[provider].id, sourceUrl, license: sources[provider].license, nature, observedAt, fetchedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlMs).toISOString(), sourceUpdatedAt: null, data })
}

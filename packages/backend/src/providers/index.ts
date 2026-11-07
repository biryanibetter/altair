import type { JobId } from '@altair/shared/contracts'
import { meteoJob } from './open-meteo'
import { qatarJob } from './qatar'
import { comtradeJob } from './comtrade'
import { gdeltJob } from './gdelt'
import type { Env, ProviderJob } from './types'
import { openskyJob, hereTrafficJob } from './transport-network'
import { aisstreamJob } from './aisstream'
import { createCameraJob } from './cameras'
export { sources } from './types'
export type { Env, ProviderJob, Batch } from './types'
export function createJobs(env: Env): Record<JobId, ProviderJob> {
  return { weather: meteoJob('weather', env), marine: meteoJob('marine', env), 'qatar-imports': qatarJob('qatar-imports', env), 'qatar-dependencies': qatarJob('qatar-dependencies', env), comtrade: comtradeJob(env), gdelt: gdeltJob(env), opensky: openskyJob(env), 'here-flow': hereTrafficJob('flow', env), 'here-incidents': hereTrafficJob('incidents', env), aisstream: aisstreamJob(env), webcams: createCameraJob([]) }
}

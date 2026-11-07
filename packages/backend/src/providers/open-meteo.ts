import { z } from 'zod'
import { observation, key, type Env, type ProviderJob } from './types'

export function meteoJob(id: 'weather' | 'marine', env: Env): ProviderJob {
  const ttlMs = 3600000
  const units = id === 'weather' ? { temperature_2m: '°C', wind_speed_10m: 'km/h', precipitation: 'mm' } : { wave_height: 'm', wave_period: 's' }
  const variables = Object.keys(units) as (keyof typeof units)[]
  const coordinate = () => z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180) }).parse({ latitude: env.INGESTION_LATITUDE ?? '25.3', longitude: (id === 'marine' ? env.INGESTION_MARINE_LONGITUDE : env.INGESTION_LONGITUDE) ?? (id === 'marine' ? '52' : '51.5') })
  const base = id === 'weather' ? 'https://api.open-meteo.com/v1/forecast' : 'https://marine-api.open-meteo.com/v1/marine'
  return {
    id, ttlMs,
    request: () => ({ url: `${base}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(coordinate()).map(([k, v]) => [k, String(v)])), hourly: variables.join(','), timezone: 'GMT', forecast_days: '2' })}` }),
    normalize: (payload, now) => {
      const parsed = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), hourly_units: z.record(z.string(), z.string()), hourly: z.object({ time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)).min(1).max(168) }).catchall(z.array(z.number().finite().nullable())) }).parse(payload)
      const observations = variables.flatMap(variable => {
        if (parsed.hourly_units[variable] !== units[variable]) throw new Error('unexpected_unit')
        const values = parsed.hourly[variable]
        if (!Array.isArray(values) || values.length !== parsed.hourly.time.length) throw new Error('misaligned_forecast')
        return parsed.hourly.time.flatMap((time, i) => {
          const value = values[i]
          if (value === null) return []
          const at = new Date(`${time}:00Z`).toISOString()
          return [observation(id, 'open-meteo', base, 'estimated', at, now, ttlMs, key(parsed.latitude, parsed.longitude, variable, at), { kind: id, latitude: parsed.latitude, longitude: parsed.longitude, variable, unit: units[variable]!, value: Number(value) })]
        })
      })
      if (!observations.length) throw new Error('no_available_forecast')
      return { observations, nextCursor: 0, coverage: 'configured-coordinate; two-day hourly model forecast' }
    },
  }
}

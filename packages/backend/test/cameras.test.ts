import { expect, it } from 'vitest'
import { createCameraJob } from '../src/providers/cameras'

const now = new Date('2026-11-07T12:00:00Z')
const feed = { id: 'licensed-public-1', url: 'https://webcam.example.org/public', license: 'Operator-reviewed public webcam license', authorization: 'licensed_public', purpose: 'public_webcam', authorizationReference: 'https://webcam.example.org/terms' }
it('requires explicit reviewed webcam authorization and never accesses a camera itself', async () => {
  expect(() => createCameraJob([]).request(0)).toThrow('integration_disabled')
  expect(() => createCameraJob([{ ...feed, purpose: 'security_cctv' }], async () => []).request(0)).toThrow()
  expect(() => createCameraJob([{ ...feed, url: 'http://127.0.0.1/cctv' }], async () => []).request(0)).toThrow()
  const job = createCameraJob([feed], async () => [{ providerId: feed.id, observedAt: now.toISOString(), available: true }])
  const batch = job.normalize(await job.collect!(), now)
  expect(batch.observations[0]).toMatchObject({ provider: 'authorized-webcam', nature: 'live', data: { kind: 'webcam', providerId: feed.id, evidenceOnly: true, feedUrl: feed.url } })
  expect(() => job.normalize([{ providerId: 'unapproved', observedAt: now.toISOString(), available: true }], now)).toThrow('camera_not_authorized')
})

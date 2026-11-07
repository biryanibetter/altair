import { expect, it } from 'vitest'
import { aisstreamJob, collectAisWindow, type AisSocket } from '../src/providers/aisstream'

const now = new Date('2026-11-07T12:00:00Z')
const message = { MessageType: 'PositionReport', MetaData: { MMSI: 123456789, time_utc: '2026-11-07 11:59:30 +0000 UTC' }, Message: { PositionReport: { Valid: true, UserID: 123456789, Latitude: 25, Longitude: 51 } } }
it('normalizes authorized AIS position broadcasts with event age and rejects AIS unavailable coordinates', () => {
  const job = aisstreamJob({})
  const batch = job.normalize([message, { MessageType: 'SubscriptionConfirmation' }], now)
  expect(batch.observations[0]).toMatchObject({ observedAt: '2026-11-07T11:59:30.000Z', data: { kind: 'vessel', providerId: '123456789', evidenceOnly: true } })
  expect(job.normalize([{ ...message, Message: { PositionReport: { ...message.Message.PositionReport, Latitude: 91, Longitude: 181 } } }], now).observations).toHaveLength(0)
  expect(() => job.normalize([{ ...message, MetaData: { MMSI: 123456789 } }], now)).toThrow()
})
it('reconnects with backoff, resubscribes, closes sockets and returns real received frames only', async () => {
  let connections = 0
  const waits: number[] = []
  const frames = await collectAisWindow({ APIKey: 'fixture', BoundingBoxes: [[[24, 50], [27, 52]]], FilterMessageTypes: ['PositionReport'] }, {
    durationMs: 10000, sleep: async ms => { waits.push(ms) }, random: () => 0,
    connect: () => {
      const socket = new EventTarget() as AisSocket
      socket.close = () => {}
      socket.send = body => {
        expect(JSON.parse(body)).toMatchObject({ FilterMessageTypes: ['PositionReport'] })
        queueMicrotask(() => { socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) })); socket.dispatchEvent(new Event('close')) })
      }
      connections++
      queueMicrotask(() => socket.dispatchEvent(new Event(connections === 1 ? 'error' : 'open')))
      return socket
    },
  })
  expect(connections).toBe(3)
  expect(waits).toEqual([1000, 2000])
  expect(frames).toHaveLength(2)
})
it('surfaces outages and provider auth errors without returning synthetic empty success', async () => {
  const connect = () => {
    const socket = new EventTarget() as AisSocket
    socket.close = () => {}; socket.send = () => {}
    queueMicrotask(() => socket.dispatchEvent(new Event('error')))
    return socket
  }
  await expect(collectAisWindow({}, { connect, sleep: async () => {}, durationMs: 20 })).rejects.toThrow('provider_unavailable')
})

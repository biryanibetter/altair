'use client'
import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import type { Observation, RouteAlternative } from '@altair/shared/contracts'
import 'maplibre-gl/dist/maplibre-gl.css'

type LayerId = 'hubs' | 'routes' | 'vessel' | 'aircraft'
type Location = { id: string; name: string; coordinates: [number, number] | null }

export function LogisticsMap({ locations, observations = [], route = null }: { locations: Location[]; observations?: Observation[]; route?: RouteAlternative | null }) {
  const container = useRef<HTMLDivElement>(null), instance = useRef<maplibregl.Map | null>(null), fitted = useRef(false)
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [layers, setLayers] = useState<Record<LayerId, boolean>>({ hubs: true, vessel: true, aircraft: true, routes: true })
  useEffect(() => {
    if (!container.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [51.5, 25.3], zoom: 4.8, pitch: 52, bearing: -18, renderWorldCopies: false, attributionControl: { compact: true } })
    } catch {
      setError('Your browser could not initialize the map. Route and shipment details remain accessible.')
      return
    }
    instance.current = map
    map.on('error', () => setError('Some map data could not load. Refresh the map or use the list views.'))
    map.on('load', () => {
      setError('')
      const style = map.getStyle()
      for (const layer of style.layers ?? []) {
        const paint = layer.paint as Record<string, unknown> | undefined
        if (layer.id === 'natural_earth') map.setPaintProperty(layer.id, 'raster-opacity', 0)
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#292c2c')
        if (layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', layer.id === 'water' ? '#1a262b' : '#2e3231')
          if (paint?.['fill-outline-color'] !== undefined) map.setPaintProperty(layer.id, 'fill-outline-color', '#414744')
        }
        if (layer.type === 'line' && paint?.['line-color'] !== undefined) map.setPaintProperty(layer.id, 'line-color', '#484b49')
        if (layer.type === 'symbol' && paint?.['text-color'] !== undefined) {
          map.setPaintProperty(layer.id, 'text-color', '#b8bdba')
          map.setPaintProperty(layer.id, 'text-halo-color', '#232827')
        }
      }
      for (const source of ['hubs', 'observations', 'routes'] as const) map.addSource(source, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'routes', type: 'line', source: 'routes', paint: { 'line-color': '#e8e4d8', 'line-width': 2, 'line-opacity': 0.9 } })
      map.addLayer({ id: 'hubs', type: 'circle', source: 'hubs', paint: { 'circle-color': '#e3e3e3', 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': '#181818' } })
      for (const kind of ['vessel', 'aircraft'] as const) map.addLayer({ id: kind, type: 'circle', source: 'observations', filter: ['==', ['get', 'kind'], kind], paint: { 'circle-color': kind === 'vessel' ? '#d8c299' : '#b3c9bb', 'circle-radius': 4, 'circle-opacity': ['case', ['get', 'stale'], 0.35, 1] } })
      for (const id of ['hubs', 'vessel', 'aircraft'] as const) map.on('click', id, event => { const item = event.features?.[0]; if (item?.geometry.type === 'Point') new maplibregl.Popup({ closeButton: false, offset: 10 }).setLngLat(item.geometry.coordinates as [number, number]).setText(String(item.properties?.label ?? '')).addTo(map) })
      for (const id of ['hubs', 'vessel', 'aircraft'] as const) { map.on('mousemove', id, () => { map.getCanvas().style.cursor = 'pointer' }); map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' }) }
      setReady(true)
    })
    return () => { instance.current = null; map.remove(); setReady(false); fitted.current = false }
  }, [])
  useEffect(() => {
    const map = instance.current
    if (!map || !ready) return
    const hubs = { type: 'FeatureCollection' as const, features: locations.filter(l => l.coordinates).map(l => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: l.coordinates! }, properties: { label: `${l.name} · catalog location, not a shipment position` } })) }
    ;(map.getSource('hubs') as GeoJSONSource).setData(hubs)
    const latest = new Map<string, Observation>()
    for (const observation of observations) {
      const d = observation.data
      if (d.kind !== 'vessel' && d.kind !== 'aircraft') continue
      const key = `${observation.provider}:${d.providerId}`, previous = latest.get(key)
      if (!previous || observation.observedAt > previous.observedAt) latest.set(key, observation)
    }
    ;(map.getSource('observations') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [...latest.values()].flatMap(o => {
      const d = o.data
      if (d.kind !== 'vessel' && d.kind !== 'aircraft') return []
      return [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [d.longitude, d.latitude] as [number, number] }, properties: { kind: d.kind, stale: Date.parse(d.freshUntil) < Date.now(), label: `${d.providerId} · ${o.provider} · ${o.nature} · observed ${o.observedAt} · evidence only, not cargo tracking` } }]
    }) })
    ;(map.getSource('routes') as GeoJSONSource).setData(route?.geometry ?? { type: 'FeatureCollection', features: [] })
    for (const [id, enabled] of Object.entries(layers)) map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none')
    if (!fitted.current) {
      const bounds = new maplibregl.LngLatBounds()
      const points = [...locations.filter(l => l.coordinates).map(l => l.coordinates!), ...(route?.nodes ?? []).flatMap(n => n.coordinates ? [n.coordinates] : [])]
      if (points.length) {
        for (const point of points) bounds.extend(point)
        map.fitBounds(bounds, { padding: 56, maxZoom: 6, duration: 0 })
        fitted.current = true
      }
    }
  }, [locations, observations, route, ready, layers])
  const toggles: [LayerId, string][] = [['hubs', 'Catalog hubs'], ['routes', 'Returned geometry'], ['vessel', 'Vessels'], ['aircraft', 'Aircraft']]
  return <section className="map-region">
    <div className="map-toolbar">{toggles.map(([key, label]) => <button key={key} aria-pressed={layers[key]} onClick={() => setLayers(value => ({ ...value, [key]: !value[key] }))}>{label}</button>)}<span>Attributed observations only</span></div>
    <div ref={container} className="map-canvas" />
    <div className="map-controls"><button disabled={!ready} onClick={() => instance.current?.easeTo({ pitch: (instance.current?.getPitch() ?? 0) > 20 ? 0 : 55, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320 })}>2D / 3D</button><button aria-label="Zoom in" disabled={!ready} onClick={() => instance.current?.zoomIn()}>+</button><button aria-label="Zoom out" disabled={!ready} onClick={() => instance.current?.zoomOut()}>−</button></div>
    {error ? <p className="map-error" role="status">{error}</p> : null}
    <div className="map-caption">{route ? `${route.geometry.features.length} returned geometry segments · ${route.geometryGaps.length} edge gaps` : 'Geographic context · shipment positions are never inferred from vessel or aircraft observations'}</div>
  </section>
}

'use client'

import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import { lazy } from 'react'
import type { ComponentType } from 'react'
import type { EventSignal } from './types'

// Internal types for react-leaflet component attributes (not exported component props)
export type LeafletMarkerAttrs = {
  position: [number, number]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any
  zIndexOffset?: number
  eventHandlers?: {
    click?: () => void
  }
}

// Props for the lazy-loaded leaflet map component
export interface LazyLeafletMapConfig {
  center: [number, number]
  zoom: number
  style?: React.CSSProperties
  scrollWheelZoom?: boolean
  tileUrl?: string
  tileAttribution?: string
  renderMarkers: (ctx: {
    Marker: ComponentType<LeafletMarkerAttrs>
    L: typeof import('leaflet')
  }) => React.ReactNode
}

/**
 * Lazy-loaded Leaflet map component using React.lazy.
 * Avoids Invalid hook call errors from dynamic import module boundaries.
 */
export const LazyLeafletMap = lazy<ComponentType<LazyLeafletMapConfig>>(async () => {
  // Guard against SSR - react-leaflet/leaflet require window
  if (typeof window === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { default: (() => null) as any }
  }

  const { MapContainer, TileLayer, Marker } = await import('react-leaflet')
  const L = (await import('leaflet')).default

  // Inject Leaflet CSS with deduplication
  const LEAFLET_CSS_ID = 'leaflet-css-1.9.4'
  if (typeof document !== 'undefined' && !document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement('link')
    link.id = LEAFLET_CSS_ID
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }

  function LazyLeafletMapComponent(props: LazyLeafletMapConfig) {
    const tileUrl = props.tileUrl ?? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    const tileAttribution = props.tileAttribution ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

    return (
      <MapContainer
        center={props.center}
        zoom={props.zoom}
        style={props.style ?? { height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={props.scrollWheelZoom ?? true}
      >
        <TileLayer attribution={tileAttribution} url={tileUrl} />
        {props.renderMarkers({ Marker: Marker as ComponentType<LeafletMarkerAttrs>, L })}
      </MapContainer>
    )
  }

  return { default: LazyLeafletMapComponent }
})

// Format number with commas (consistent across server/client)
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Map placeholder shown during SSR or when Leaflet isn't loaded
export function MapPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <MapPin className="h-8 w-8" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
}

export function EventSignalBadge({ signal }: { signal: EventSignal }) {
  const config: Record<EventSignal, { label: string; className: string }> = {
    'going-fast': { label: 'Going Fast', className: 'bg-orange-100 text-orange-700' },
    'popular': { label: 'Popular', className: 'bg-pink-100 text-pink-700' },
    'just-added': { label: 'Just Added', className: 'bg-blue-100 text-blue-700' },
    'sales-end-soon': { label: 'Sales end soon', className: 'bg-red-100 text-red-700' },
    'few-tickets-left': { label: 'Few Tickets Left', className: 'bg-orange-100 text-orange-700' },
    'canceled': { label: 'Canceled', className: 'bg-gray-100 text-gray-700' },
    'ended': { label: 'Ended', className: 'bg-gray-100 text-gray-700' },
    'postponed': { label: 'Postponed', className: 'bg-yellow-100 text-yellow-700' }
  }

  const { label, className } = config[signal]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium', className)}>
      {label}
    </span>
  )
}

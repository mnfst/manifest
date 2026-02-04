'use client'

import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import type { EventSignal } from './types'

// Internal types for react-leaflet component attributes (not exported component props)
export type LeafletMapContainerAttrs = {
  center: [number, number]
  zoom: number
  style?: React.CSSProperties
  zoomControl?: boolean
  scrollWheelZoom?: boolean
  children?: React.ReactNode
}

export type LeafletTileLayerAttrs = {
  attribution: string
  url: string
}

export type LeafletMarkerAttrs = {
  position: [number, number]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any
  zIndexOffset?: number
  eventHandlers?: {
    click?: () => void
  }
}

// Lazy-loaded react-leaflet components (React-only, no Next.js dependency)
// Using any to avoid type mismatches between react-leaflet versions and @types/react
export interface ReactLeafletComponents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MapContainer: ComponentType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TileLayer: ComponentType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Marker: ComponentType<any>
}

/**
 * Hook to lazy load react-leaflet components on client-side only.
 * This avoids SSR issues with Leaflet without requiring Next.js dynamic imports.
 */
export function useReactLeaflet(): ReactLeafletComponents | null {
  const [components, setComponents] = useState<ReactLeafletComponents | null>(null)

  useEffect(() => {
    let mounted = true
    import('react-leaflet').then((mod) => {
      if (mounted) {
        setComponents({
          MapContainer: mod.MapContainer,
          TileLayer: mod.TileLayer,
          Marker: mod.Marker,
        })
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  return components
}

/**
 * Injects Leaflet CSS into the document head if not already present.
 * Returns a cleanup function that is safe to call (no-op if other components still need it).
 */
const LEAFLET_CSS_ID = 'leaflet-css-1.9.4'

export function injectLeafletCSS(): () => void {
  if (typeof document === 'undefined') return () => {}

  const existing = document.getElementById(LEAFLET_CSS_ID)
  if (existing) {
    return () => {} // CSS already present, no-op cleanup
  }

  const link = document.createElement('link')
  link.id = LEAFLET_CSS_ID
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)

  return () => {
    // Only remove if no other map components are mounted
    // We leave the CSS in place to avoid flicker on re-mount
  }
}

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

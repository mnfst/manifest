'use client'

import {
  Cloud,
  CloudRain,
  CloudSnow,
  Droplets,
  Sun,
  Thermometer,
  Wind
} from 'lucide-react'

export interface WeatherData {
  location: string
  temperature: number
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy'
  humidity: number
  windSpeed: number
  feelsLike: number
}

const weatherIcons = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow
}

const weatherLabels = {
  sunny: 'Sunny',
  cloudy: 'Cloudy',
  rainy: 'Rainy',
  snowy: 'Snowy'
}

interface WeatherWidgetProps {
  data?: WeatherData
}

const defaultData: WeatherData = {
  location: 'San Francisco, CA',
  temperature: 72,
  condition: 'sunny',
  humidity: 45,
  windSpeed: 12,
  feelsLike: 70
}

export function WeatherWidget({ data = defaultData }: WeatherWidgetProps) {
  const WeatherIcon = weatherIcons[data.condition]

  return (
    <div className="w-full flex items-center justify-between gap-4 rounded-lg bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <WeatherIcon className="h-8 w-8 text-yellow-500" />
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{data.temperature}°F</span>
            <span className="text-sm text-muted-foreground">
              {weatherLabels[data.condition]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{data.location}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Thermometer className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{data.feelsLike}°F</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Droplets className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{data.humidity}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wind className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{data.windSpeed} mph</span>
        </div>
      </div>
    </div>
  )
}

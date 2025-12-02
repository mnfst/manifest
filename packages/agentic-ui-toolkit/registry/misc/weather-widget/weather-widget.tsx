"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Droplets,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react"

export interface WeatherData {
  location: string
  temperature: number
  condition: "sunny" | "cloudy" | "rainy" | "snowy"
  humidity: number
  windSpeed: number
  feelsLike: number
}

const weatherIcons = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
}

const weatherLabels = {
  sunny: "Sunny",
  cloudy: "Cloudy",
  rainy: "Rainy",
  snowy: "Snowy",
}

interface WeatherWidgetProps {
  data?: WeatherData
}

const defaultData: WeatherData = {
  location: "San Francisco, CA",
  temperature: 72,
  condition: "sunny",
  humidity: 45,
  windSpeed: 12,
  feelsLike: 70,
}

export function WeatherWidget({ data = defaultData }: WeatherWidgetProps) {
  const WeatherIcon = weatherIcons[data.condition]

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-2">
        <CardDescription>{data.location}</CardDescription>
        <CardTitle className="flex items-center gap-3">
          <WeatherIcon className="h-10 w-10 text-primary" />
          <span className="text-4xl font-bold">{data.temperature}°F</span>
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {weatherLabels[data.condition]}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="flex flex-col items-center gap-1">
            <Thermometer className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Feels like</span>
            <span className="text-sm font-medium">{data.feelsLike}°F</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Droplets className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Humidity</span>
            <span className="text-sm font-medium">{data.humidity}%</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Wind className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Wind</span>
            <span className="text-sm font-medium">{data.windSpeed} mph</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

import { ResizeOptions } from 'sharp'

export interface ImageSize {
  name: string
  height: number
  width: number
  options?: ResizeOptions
}

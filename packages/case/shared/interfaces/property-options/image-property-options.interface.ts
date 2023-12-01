import { ImageSize } from '../image-size.interface'
import { PropertyOptions } from './property-options.interface'

export interface ImagePropertyOptions extends PropertyOptions {
  // Image sizes to generate. Default is a thumbnail (80x80) and a large image (800x800).
  sizes: ImageSize[]
}

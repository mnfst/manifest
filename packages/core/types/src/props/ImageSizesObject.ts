export type ImageSizesObject = {
  [key: string]: {
    width?: number
    height?: number
    fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
  }
}

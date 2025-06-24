import { ImageSizesObject, PropType } from '../../../../types/src'

export interface EntityTsTypeInfo {
  name: string
  properties: PropertyTsTypeInfo[]
}

export interface PropertyTsTypeInfo {
  name: string
  type: string
  manifestPropType: PropType
  optional?: boolean
  values?: string[] | null
  sizes?: ImageSizesObject
}

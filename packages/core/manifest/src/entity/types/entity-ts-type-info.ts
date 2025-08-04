import { ImageSizesObject, PropType } from '../../../../types/src'

export interface EntityTsTypeInfo {
  name: string
  properties: PropertyTsTypeInfo[]
  nested?: boolean
}

export interface PropertyTsTypeInfo {
  name: string
  type: string | object // Image sizes are represented as an object.
  manifestPropType?: PropType
  isRelationship?: boolean
  optional?: boolean
  values?: string[] | null
  sizes?: ImageSizesObject
}

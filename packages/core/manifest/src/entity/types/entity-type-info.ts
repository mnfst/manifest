export interface EntityTypeInfo {
  name: string
  properties: PropertyTypeInfo[]
}

export interface PropertyTypeInfo {
  name: string
  type: string
  optional?: boolean
  values?: string[] | null
}

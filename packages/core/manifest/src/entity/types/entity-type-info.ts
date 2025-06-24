export interface EntityTypeInfo {
  name: string
  properties: {
    name: string
    type: string
    optional?: boolean
    values?: string[] | null
  }[]
}

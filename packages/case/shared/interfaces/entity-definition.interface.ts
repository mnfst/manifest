export interface EntityDefinition {
  nameSingular: string
  namePlural: string
  slug: string
  propIdentifier: string

  seedCount?: number
  apiPolicies?: {
    create?: () => Promise<boolean>
    read?: () => Promise<boolean>
    update?: () => Promise<boolean>
    delete?: () => Promise<boolean>
  }
}

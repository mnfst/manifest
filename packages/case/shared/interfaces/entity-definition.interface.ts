import { ApiRestriction } from '../enums/api-restriction.enum'

export interface EntityDefinition {
  nameSingular: string
  namePlural: string
  slug: string
  propIdentifier: string

  seedCount?: number
  apiRestrictions?: {
    create?: ApiRestriction
    read?: ApiRestriction
    update?: ApiRestriction
    delete?: ApiRestriction
  }
}

import { ResourceDefinition } from '../resource-definition.interface'

export interface DeleteActionConfig {
  itemToDelete: any
  definition: ResourceDefinition
  redirectTo?: string
  redirectToQueryParams?: { [key: string]: string }
}

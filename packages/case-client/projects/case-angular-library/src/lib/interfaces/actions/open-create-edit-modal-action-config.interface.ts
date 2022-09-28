import { Field } from '../field.interface'
import { ResourceDefinition } from '../resource-definition.interface'
import { ResourceMode } from '../../enums/resource-mode.enum'

export interface OpenCreateEditModalActionConfig {
  title: string
  fields: Field[]
  definition: ResourceDefinition
  mode: ResourceMode

  // Custom patch URL if mode is Patch
  patchURL?: string

  // Mandatory if mode is Edit: pass the item to edit.
  item?: any

  // Redirect after successful submission.
  redirectTo?: string
  redirectToQueryParams?: { [key: string]: string }

  // Modal content (not related to form).
  helpText?: string
  keyPoints?: { label: string; value: string }[]
}

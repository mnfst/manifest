import { Action } from './actions/action.interface'

export interface DropdownLink {
  label: string
  action: (resource: any) => Action
  permission?: string
  condition?: (resource: any) => boolean
  disabled?: (resource: any) => boolean
  tooltip?: (resource: any) => string
  className?: string
  withDivision?: boolean
}

import { Action } from './actions/action.interface'

export interface ActionButton {
  label: string
  action: (resource: any) => Action
  icon?: string
  className?: string
  permission?: string
  condition?: (resource: any) => boolean
}

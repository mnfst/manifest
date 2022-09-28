import { Params } from '@angular/router'
import { User } from './user.interface'

export interface Notification {
  id: number
  description: string
  linkPath: string
  date: Date
  user: User
  isHighlighted: boolean

  // Calculated.
  queryParams?: Params
}

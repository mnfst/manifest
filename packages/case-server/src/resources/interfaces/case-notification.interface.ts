import { CaseUser } from './case-user.interface'

export interface CaseNotification {
  id: number
  description: string
  linkPath: string
  date: Date
  isHighlighted: boolean

  user: CaseUser
}

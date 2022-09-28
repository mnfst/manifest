import { CaseRole } from './case-role.interface'

export interface CaseUser {
  id: number
  name: string
  email: string
  password: string
  token: string
  isActive: boolean
  lastNotificationCheck: Date
  role: CaseRole
}

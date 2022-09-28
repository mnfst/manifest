import { CasePermission } from './case-permission.interface'
import { CaseUser } from './case-user.interface'

export interface CaseRole {
  id: number
  name: string
  displayName: string
  homepagePath: string
  permissions: CasePermission[]
  users: CaseUser[]
}

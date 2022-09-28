import { CaseRole } from './case-role.interface'

export interface CasePermission {
  id: number
  name: string
  roles: CaseRole[]
}

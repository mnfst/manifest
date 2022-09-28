import { Role } from './role.interface'

export interface User {
  id: number
  name: string
  email: string
  image: string
  password?: string
  token: string
  role: Role
}

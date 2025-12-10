import { SetMetadata } from '@nestjs/common'
import { AdminAccess as AdminAccessType } from '../../../../types/src/auth/admin-access.type'

export const AdminAccess = (adminAccess: AdminAccessType) =>
  SetMetadata('adminAccess', adminAccess)

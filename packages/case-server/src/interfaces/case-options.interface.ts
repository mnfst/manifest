import { Reflector } from '@nestjs/core'
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions'

export interface CaseOptions {
  userEntity: any
  notificationEntity: any
  permissionEntity: any
  roleEntity: any

  connectionOptions: MysqlConnectionOptions
  reflector: Reflector
}

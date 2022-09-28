import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { DataSource } from 'typeorm'

import { AuthModule } from './auth/auth.module'
import { AuthService } from './auth/auth.service'
import { UploadController } from './files/controllers/upload.controller'
import { DocXService } from './files/services/doc-x.service'
import { ExcelService } from './files/services/excel.service'
import { FileService } from './files/services/file.service'
import { ImageService } from './files/services/image.service'
import { PdfService } from './files/services/pdf.service'
import { CaseOptions } from './interfaces/case-options.interface'
import { NotificationModule } from './resources/notification/notification.module'
import { PermissionModule } from './resources/permission/permission.module'
import { RoleModule } from './resources/role/role.module'
import { BugsnagLoggerService } from './services/bugsnag-logger.service'
import { EmailService } from './services/email.service'
import { HelperService } from './services/helper.service'
import { PaginationService } from './services/pagination.service'

@Global()
@Module({
  imports: [AuthModule]
})
export class CaseCoreModule {
  static forRoot(options: CaseOptions): DynamicModule {
    const providers: Provider[] = [
      ExcelService,
      DocXService,
      ExcelService,
      PdfService,
      HelperService,
      PaginationService,
      FileService,
      ImageService,
      EmailService,
      BugsnagLoggerService,
      AuthService,
      {
        provide: 'USER',
        useValue: options.userEntity
      },
      {
        provide: 'NOTIFICATION',
        useValue: options.notificationEntity
      },
      {
        provide: 'PERMISSION',
        useValue: options.permissionEntity
      },
      {
        provide: 'ROLE',
        useValue: options.roleEntity
      },
      {
        provide: 'REFLECTOR',
        useValue: options.reflector
      },
      {
        provide: 'DATA_SOURCE',
        useFactory: async () => {
          const dataSource = new DataSource({
            type: options.connectionOptions.type,
            host: options.connectionOptions.host,
            port: options.connectionOptions.port,
            username: options.connectionOptions.username,
            password: options.connectionOptions.password,
            database: options.connectionOptions.database,
            entities: [
              options.roleEntity,
              options.userEntity,
              options.roleEntity,
              options.permissionEntity,
              options.notificationEntity
            ],
            synchronize: false
          })

          return dataSource.initialize()
        }
      }
    ]

    return {
      module: CaseCoreModule,
      imports: [NotificationModule, RoleModule, PermissionModule, AuthModule],
      providers: providers,
      exports: providers,
      controllers: [UploadController]
    }
  }
}

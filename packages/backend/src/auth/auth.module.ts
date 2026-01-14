import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth';
import { UserAppRoleEntity } from './user-app-role.entity';
import { AppAccessGuard } from './app-access.guard';
import { FlowAccessGuard } from './flow-access.guard';
import { AppAccessService } from './app-access.service';
import { UserManagementService } from './user-management.service';
import { UserManagementController } from './user-management.controller';
import { FlowEntity } from '../flow/flow.entity';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { EmailModule } from '../email/email.module';

/**
 * Authentication module using better-auth
 * Provides user authentication, session management, and app-level authorization
 */
@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: true, // We use our own guard with @Public() decorator
      disableTrustedOriginsCors: true, // CORS handled by NestJS in main.ts
      // Fix for Express 5 /*path pattern: restores req.url before better-auth handler
      // See: https://github.com/ThallesP/nestjs-better-auth/issues/85
      middleware: (req, _res, next) => {
        req.url = req.originalUrl;
        req.baseUrl = '';
        next();
      },
    }),
    TypeOrmModule.forFeature([UserAppRoleEntity, FlowEntity, EmailVerificationTokenEntity]),
    forwardRef(() => EmailModule),
  ],
  controllers: [UserManagementController],
  providers: [AppAccessGuard, FlowAccessGuard, AppAccessService, UserManagementService],
  exports: [BetterAuthModule, AppAccessGuard, FlowAccessGuard, AppAccessService, UserManagementService, TypeOrmModule],
})
export class AuthModule {}

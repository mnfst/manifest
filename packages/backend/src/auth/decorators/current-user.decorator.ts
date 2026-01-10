import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Session user type from better-auth
 */
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session type from better-auth
 */
export interface Session {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Decorator to inject the current authenticated user into a controller method
 * Returns undefined if no user is authenticated (use with AuthGuard to ensure user exists)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof SessionUser | undefined, ctx: ExecutionContext): SessionUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const session = request.session as Session | undefined;

    if (!session?.user) {
      return undefined;
    }

    return data ? session.user[data] : session.user;
  },
);

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { AppAccessGuard } from './app-access.guard';
import { AppAccessService } from './app-access.service';

describe('AppAccessGuard', () => {
  let guard: AppAccessGuard;

  const mockAppAccessService = {
    hasAccess: jest.fn(),
    getUserAppRole: jest.fn(),
    isOwner: jest.fn(),
    canManageUsers: jest.fn(),
    getAppIdsForUser: jest.fn(),
    assignRole: jest.fn(),
    removeAccess: jest.fn(),
  };

  const createMockExecutionContext = (
    params: Record<string, string>,
    session?: { user: { id: string } },
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params,
          session,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppAccessGuard,
        {
          provide: AppAccessService,
          useValue: mockAppAccessService,
        },
      ],
    }).compile();

    guard = module.get<AppAccessGuard>(AppAccessGuard);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when no session exists (let AuthGuard handle it)', async () => {
      const context = createMockExecutionContext({ appId: 'app-1' }, undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAppAccessService.hasAccess).not.toHaveBeenCalled();
    });

    it('should return true when session has no user', async () => {
      const context = createMockExecutionContext(
        { appId: 'app-1' },
        { user: undefined as unknown as { id: string } },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAppAccessService.hasAccess).not.toHaveBeenCalled();
    });

    it('should return true when no appId in params', async () => {
      const context = createMockExecutionContext({}, { user: { id: 'user-1' } });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAppAccessService.hasAccess).not.toHaveBeenCalled();
    });

    it('should return true when user has access', async () => {
      mockAppAccessService.hasAccess.mockResolvedValue(true);
      const context = createMockExecutionContext(
        { appId: 'app-1' },
        { user: { id: 'user-1' } },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAppAccessService.hasAccess).toHaveBeenCalledWith('user-1', 'app-1');
    });

    it('should throw NotFoundException when user does not have access', async () => {
      mockAppAccessService.hasAccess.mockResolvedValue(false);
      const context = createMockExecutionContext(
        { appId: 'app-1' },
        { user: { id: 'user-1' } },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
      await expect(guard.canActivate(context)).rejects.toThrow('App not found');
    });

    it('should use id param as fallback when appId not present', async () => {
      mockAppAccessService.hasAccess.mockResolvedValue(true);
      const context = createMockExecutionContext(
        { id: 'app-1' },
        { user: { id: 'user-1' } },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAppAccessService.hasAccess).toHaveBeenCalledWith('user-1', 'app-1');
    });

    it('should prioritize appId over id param', async () => {
      mockAppAccessService.hasAccess.mockResolvedValue(true);
      const context = createMockExecutionContext(
        { appId: 'app-1', id: 'app-2' },
        { user: { id: 'user-1' } },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAppAccessService.hasAccess).toHaveBeenCalledWith('user-1', 'app-1');
    });
  });
});

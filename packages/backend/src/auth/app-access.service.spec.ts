import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppAccessService } from './app-access.service';
import { UserAppRoleEntity } from './user-app-role.entity';

describe('AppAccessService', () => {
  let service: AppAccessService;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppAccessService,
        {
          provide: getRepositoryToken(UserAppRoleEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AppAccessService>(AppAccessService);

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe('getUserAppRole', () => {
    it('should return owner role when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'owner',
        createdAt: new Date(),
      });

      const result = await service.getUserAppRole('user-1', 'app-1');

      expect(result).toBe('owner');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', appId: 'app-1' },
      });
    });

    it('should return admin role when user is admin', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'admin',
        createdAt: new Date(),
      });

      const result = await service.getUserAppRole('user-1', 'app-1');

      expect(result).toBe('admin');
    });

    it('should return null when user has no access', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserAppRole('user-1', 'app-1');

      expect(result).toBeNull();
    });
  });

  describe('hasAccess', () => {
    it('should return true when user has owner role', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'owner',
        createdAt: new Date(),
      });

      const result = await service.hasAccess('user-1', 'app-1');

      expect(result).toBe(true);
    });

    it('should return true when user has admin role', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'admin',
        createdAt: new Date(),
      });

      const result = await service.hasAccess('user-1', 'app-1');

      expect(result).toBe(true);
    });

    it('should return false when user has no role', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.hasAccess('user-1', 'app-1');

      expect(result).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('should return true when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'owner',
        createdAt: new Date(),
      });

      const result = await service.isOwner('user-1', 'app-1');

      expect(result).toBe(true);
    });

    it('should return false when user is admin', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'admin',
        createdAt: new Date(),
      });

      const result = await service.isOwner('user-1', 'app-1');

      expect(result).toBe(false);
    });

    it('should return false when user has no access', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.isOwner('user-1', 'app-1');

      expect(result).toBe(false);
    });
  });

  describe('canManageUsers', () => {
    it('should return true when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'owner',
        createdAt: new Date(),
      });

      const result = await service.canManageUsers('user-1', 'app-1');

      expect(result).toBe(true);
    });

    it('should return true when user is admin', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'admin',
        createdAt: new Date(),
      });

      const result = await service.canManageUsers('user-1', 'app-1');

      expect(result).toBe(true);
    });

    it('should return false when user has no access', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.canManageUsers('user-1', 'app-1');

      expect(result).toBe(false);
    });
  });

  describe('getAppIdsForUser', () => {
    it('should return all app ids for a user', async () => {
      mockRepository.find.mockResolvedValue([
        { appId: 'app-1' },
        { appId: 'app-2' },
        { appId: 'app-3' },
      ]);

      const result = await service.getAppIdsForUser('user-1');

      expect(result).toEqual(['app-1', 'app-2', 'app-3']);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: ['appId'],
      });
    });

    it('should return empty array when user has no apps', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getAppIdsForUser('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('assignRole', () => {
    it('should create new role when user has no existing access', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const createdRole = {
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'admin' as const,
        createdAt: new Date(),
      };
      mockRepository.create.mockReturnValue(createdRole);
      mockRepository.save.mockResolvedValue(createdRole);

      const result = await service.assignRole('user-1', 'app-1', 'admin');

      expect(result).toEqual(createdRole);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        appId: 'app-1',
        role: 'admin',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(createdRole);
    });

    it('should update existing role when user already has access', async () => {
      const existingRole = {
        id: 'role-1',
        userId: 'user-1',
        appId: 'app-1',
        role: 'admin' as const,
        createdAt: new Date(),
      };
      mockRepository.findOne.mockResolvedValue(existingRole);

      const updatedRole = { ...existingRole, role: 'owner' as const };
      mockRepository.save.mockResolvedValue(updatedRole);

      const result = await service.assignRole('user-1', 'app-1', 'owner');

      expect(result).toEqual(updatedRole);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'owner' }),
      );
    });
  });

  describe('removeAccess', () => {
    it('should delete the user-app role', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.removeAccess('user-1', 'app-1');

      expect(mockRepository.delete).toHaveBeenCalledWith({
        userId: 'user-1',
        appId: 'app-1',
      });
    });
  });
});

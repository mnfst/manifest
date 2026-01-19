import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AppAccessService } from './app-access.service';
import type { SessionUser } from './decorators/current-user.decorator';
import type { AppUser } from '@manifest/shared';

// Mock the auth module to avoid better-auth ESM import issues
jest.mock('./auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
      listUsers: jest.fn(),
    },
  },
}));

// Import controller after mocking auth
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';

describe('UserManagementController', () => {
  let controller: UserManagementController;

  const mockUserManagementService = {
    getAppUsers: jest.fn(),
    getAppUsersWithPending: jest.fn(),
    addUserToApp: jest.fn(),
    removeUserFromApp: jest.fn(),
    searchUserByEmail: jest.fn(),
    checkDefaultUserExists: jest.fn(),
  };

  const mockAppAccessService = {
    canManageUsers: jest.fn(),
    hasAccess: jest.fn(),
    getUserAppRole: jest.fn(),
    isOwner: jest.fn(),
    getAppIdsForUser: jest.fn(),
    assignRole: jest.fn(),
    removeAccess: jest.fn(),
  };

  const mockUser: SessionUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [
        {
          provide: UserManagementService,
          useValue: mockUserManagementService,
        },
        {
          provide: AppAccessService,
          useValue: mockAppAccessService,
        },
      ],
    }).compile();

    controller = module.get<UserManagementController>(UserManagementController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCurrentUser', () => {
    it('should return current user profile', async () => {
      const result = await controller.getCurrentUser(mockUser);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        createdAt: mockUser.createdAt.toISOString(),
      });
    });
  });

  describe('searchUsers', () => {
    it('should return user when found', async () => {
      const foundUser = {
        id: 'user-2',
        email: 'found@example.com',
        name: 'Found User',
      };
      mockUserManagementService.searchUserByEmail.mockResolvedValue(foundUser);

      const result = await controller.searchUsers('found@example.com');

      expect(result).toEqual({
        id: 'user-2',
        email: 'found@example.com',
        name: 'Found User',
        createdAt: '',
      });
      expect(mockUserManagementService.searchUserByEmail).toHaveBeenCalledWith(
        'found@example.com',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserManagementService.searchUserByEmail.mockResolvedValue(null);

      await expect(controller.searchUsers('notfound@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listAppUsers', () => {
    it('should return list of app users', async () => {
      const appUsers: AppUser[] = [
        {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner',
          role: 'owner',
          isOwner: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'user-2',
          email: 'admin@example.com',
          name: 'Admin',
          role: 'admin',
          isOwner: false,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];
      mockUserManagementService.getAppUsersWithPending.mockResolvedValue(appUsers);

      const result = await controller.listAppUsers('app-1');

      expect(result).toEqual(appUsers);
      expect(mockUserManagementService.getAppUsersWithPending).toHaveBeenCalledWith('app-1');
    });
  });

  describe('addUserToApp', () => {
    it('should add user when caller can manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(true);
      const addedUser: AppUser = {
        id: 'user-2',
        email: 'new@example.com',
        name: 'New User',
        role: 'admin',
        isOwner: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockUserManagementService.addUserToApp.mockResolvedValue(addedUser);

      const result = await controller.addUserToApp(
        'app-1',
        { email: 'new@example.com', role: 'admin' },
        mockUser,
      );

      expect(result).toEqual(addedUser);
      expect(mockAppAccessService.canManageUsers).toHaveBeenCalledWith(
        'user-1',
        'app-1',
      );
      expect(mockUserManagementService.addUserToApp).toHaveBeenCalledWith(
        'app-1',
        'new@example.com',
        'admin',
      );
    });

    it('should throw NotFoundException when caller cannot manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(false);

      await expect(
        controller.addUserToApp(
          'app-1',
          { email: 'new@example.com', role: 'admin' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.addUserToApp(
          'app-1',
          { email: 'new@example.com', role: 'admin' },
          mockUser,
        ),
      ).rejects.toThrow('App not found');
    });
  });

  describe('removeUserFromApp', () => {
    it('should remove user when caller can manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(true);
      mockUserManagementService.removeUserFromApp.mockResolvedValue(undefined);

      await controller.removeUserFromApp('app-1', 'user-2', mockUser);

      expect(mockAppAccessService.canManageUsers).toHaveBeenCalledWith(
        'user-1',
        'app-1',
      );
      expect(mockUserManagementService.removeUserFromApp).toHaveBeenCalledWith(
        'app-1',
        'user-2',
      );
    });

    it('should throw NotFoundException when caller cannot manage users', async () => {
      mockAppAccessService.canManageUsers.mockResolvedValue(false);

      await expect(
        controller.removeUserFromApp('app-1', 'user-2', mockUser),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.removeUserFromApp('app-1', 'user-2', mockUser),
      ).rejects.toThrow('App not found');
    });
  });

  describe('checkDefaultUser', () => {
    it('should return credentials when default user exists', async () => {
      const defaultUserResponse = {
        exists: true,
        email: 'admin@manifest.build',
        password: 'admin',
      };
      mockUserManagementService.checkDefaultUserExists.mockResolvedValue(defaultUserResponse);

      const result = await controller.checkDefaultUser();

      expect(result).toEqual(defaultUserResponse);
      expect(mockUserManagementService.checkDefaultUserExists).toHaveBeenCalled();
    });

    it('should return exists: false when default user does not exist', async () => {
      const defaultUserResponse = { exists: false };
      mockUserManagementService.checkDefaultUserExists.mockResolvedValue(defaultUserResponse);

      const result = await controller.checkDefaultUser();

      expect(result).toEqual({ exists: false });
      expect(mockUserManagementService.checkDefaultUserExists).toHaveBeenCalled();
    });

    it('should return exists: false when default user password was changed', async () => {
      const defaultUserResponse = { exists: false };
      mockUserManagementService.checkDefaultUserExists.mockResolvedValue(defaultUserResponse);

      const result = await controller.checkDefaultUser();

      expect(result).toEqual({ exists: false });
    });
  });
});

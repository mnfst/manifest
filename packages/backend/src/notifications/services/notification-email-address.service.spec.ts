jest.mock('../../common/constants/local-mode.constants', () => ({
  readLocalNotificationEmail: jest.fn(),
  writeLocalNotificationEmail: jest.fn(),
}));

import { BadRequestException } from '@nestjs/common';
import { NotificationEmailAddressService } from './notification-email-address.service';
import {
  readLocalNotificationEmail,
  writeLocalNotificationEmail,
} from '../../common/constants/local-mode.constants';

describe('NotificationEmailAddressService (local mode)', () => {
  let service: NotificationEmailAddressService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MANIFEST_MODE: 'local' };
    service = new NotificationEmailAddressService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getNotificationEmail', () => {
    it('returns email when set in config', () => {
      (readLocalNotificationEmail as jest.Mock).mockReturnValue('user@real.com');
      const result = service.getNotificationEmail();
      expect(result).toEqual({ email: 'user@real.com', isDefault: false });
    });

    it('returns null with isDefault true when not set', () => {
      (readLocalNotificationEmail as jest.Mock).mockReturnValue(null);
      const result = service.getNotificationEmail();
      expect(result).toEqual({ email: null, isDefault: true });
    });
  });

  describe('saveNotificationEmail', () => {
    it('writes email to config file', () => {
      service.saveNotificationEmail('user@real.com');
      expect(writeLocalNotificationEmail).toHaveBeenCalledWith('user@real.com');
    });
  });
});

describe('NotificationEmailAddressService (cloud mode)', () => {
  let service: NotificationEmailAddressService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MANIFEST_MODE: 'cloud' };
    service = new NotificationEmailAddressService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('getNotificationEmail throws BadRequestException', () => {
    expect(() => service.getNotificationEmail()).toThrow(BadRequestException);
  });

  it('saveNotificationEmail throws BadRequestException', () => {
    expect(() => service.saveNotificationEmail('user@real.com')).toThrow(BadRequestException);
  });
});

import { WaitlistController } from './waitlist.controller';

describe('WaitlistController', () => {
  it('keeps the legacy self-hosted claim endpoint as a no-op success', () => {
    const controller = new WaitlistController();

    expect(controller.receiveClaim()).toEqual({ ok: true });
  });
});

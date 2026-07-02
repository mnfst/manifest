import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { PlanService } from './plan.service';

describe('BillingController', () => {
  let controller: BillingController;
  const getBillingStatus = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: PlanService, useValue: { getBillingStatus } }],
    }).compile();
    controller = module.get(BillingController);
  });

  it('returns the billing status for the request tenant context', async () => {
    const status = { enabled: false };
    getBillingStatus.mockResolvedValue(status);
    const ctx = { tenantId: 't1', userId: 'u1' };
    const result = await controller.status(ctx as never);
    expect(getBillingStatus).toHaveBeenCalledWith(ctx);
    expect(result).toBe(status);
  });
});

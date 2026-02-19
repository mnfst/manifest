import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns healthy status with version', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('healthy');
    expect(result.version).toBe('0.1.0');
    expect(typeof result.uptime_seconds).toBe('number');
  });
});

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent } from '../../entities/agent.entity';
import { AgentRecordingCacheService } from './agent-recording-cache.service';

describe('AgentRecordingCacheService', () => {
  const findOne = jest.fn();
  let service: AgentRecordingCacheService;

  beforeEach(async () => {
    findOne.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        AgentRecordingCacheService,
        { provide: getRepositoryToken(Agent), useValue: { findOne } },
      ],
    }).compile();
    service = module.get(AgentRecordingCacheService);
  });

  it('does not query for a missing agent id', async () => {
    await expect(service.isRecording(undefined)).resolves.toBe(false);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('caches enabled flags and refreshes them after invalidation', async () => {
    findOne
      .mockResolvedValueOnce({ id: 'agent-1', record_messages: true })
      .mockResolvedValueOnce({ id: 'agent-1', record_messages: false });

    await expect(service.isRecording('agent-1')).resolves.toBe(true);
    await expect(service.isRecording('agent-1')).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledTimes(1);

    service.invalidate('agent-1');
    await expect(service.isRecording('agent-1')).resolves.toBe(false);
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentRecordingCacheService } from './agent-recording-cache.service';
import { Agent } from '../../entities/agent.entity';

describe('AgentRecordingCacheService', () => {
  let service: AgentRecordingCacheService;
  let mockFindOne: jest.Mock;

  beforeEach(async () => {
    mockFindOne = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRecordingCacheService,
        { provide: getRepositoryToken(Agent), useValue: { findOne: mockFindOne } },
      ],
    }).compile();
    service = module.get(AgentRecordingCacheService);
  });

  it('returns false without a DB hit when agentId is falsy', async () => {
    expect(await service.isRecording(undefined)).toBe(false);
    expect(await service.isRecording(null)).toBe(false);
    expect(await service.isRecording('')).toBe(false);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('returns false when the agent has record_messages=false', async () => {
    mockFindOne.mockResolvedValue({ id: 'a-1', record_messages: false });
    expect(await service.isRecording('a-1')).toBe(false);
  });

  it('returns true when record_messages is enabled', async () => {
    mockFindOne.mockResolvedValue({ id: 'a-2', record_messages: true });
    expect(await service.isRecording('a-2')).toBe(true);
  });

  it('returns false when the agent is missing entirely', async () => {
    mockFindOne.mockResolvedValue(null);
    expect(await service.isRecording('missing')).toBe(false);
  });

  it('caches subsequent lookups', async () => {
    mockFindOne.mockResolvedValue({ id: 'a-3', record_messages: true });
    expect(await service.isRecording('a-3')).toBe(true);
    expect(await service.isRecording('a-3')).toBe(true);
    expect(mockFindOne).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after invalidation', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 'a-4', record_messages: true });
    expect(await service.isRecording('a-4')).toBe(true);
    service.invalidate('a-4');
    mockFindOne.mockResolvedValueOnce({ id: 'a-4', record_messages: false });
    expect(await service.isRecording('a-4')).toBe(false);
    expect(mockFindOne).toHaveBeenCalledTimes(2);
  });
});

import { Test, type TestingModule } from '@nestjs/testing';
import type { Response as ExpressResponse } from 'express';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { PlaygroundHistoryService } from './playground-history.service';
import { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import type { AuthUser } from '../auth/auth.instance';
import type { RunPlaygroundDto } from './dto/run-playground.dto';

const USER: AuthUser = {
  id: 'user-1',
  name: 'tester',
  email: 't@example.com',
} as unknown as AuthUser;

const AGENT = { id: 'agent-1', tenant_id: 'tenant-1', name: 'demo' };

describe('PlaygroundController', () => {
  let controller: PlaygroundController;
  let runStream: jest.Mock;
  let listRuns: jest.Mock;
  let getRun: jest.Mock;
  let toggleStar: jest.Mock;
  let setBestColumn: jest.Mock;
  let resolveAgent: jest.Mock;

  beforeEach(async () => {
    runStream = jest.fn();
    listRuns = jest.fn();
    getRun = jest.fn();
    toggleStar = jest.fn();
    setBestColumn = jest.fn();
    resolveAgent = jest.fn().mockResolvedValue(AGENT);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaygroundController],
      providers: [
        { provide: PlaygroundService, useValue: { runStream } },
        {
          provide: PlaygroundHistoryService,
          useValue: { listRuns, getRun, toggleStar, setBestColumn },
        },
        { provide: ResolveAgentService, useValue: { resolve: resolveAgent } },
      ],
    }).compile();

    controller = module.get(PlaygroundController);
  });

  describe('POST /playground/run', () => {
    it('delegates to PlaygroundService.runStream with the user id, dto and response', async () => {
      const dto = {
        agentName: 'demo',
        model: 'openai/gpt-4o-mini',
        provider: 'openai',
        messages: [{ role: 'user', content: 'hi' }],
      } as unknown as RunPlaygroundDto;
      const res = {} as ExpressResponse;
      runStream.mockResolvedValue(undefined);

      const out = await controller.run(USER, dto, res);

      expect(runStream).toHaveBeenCalledWith('user-1', dto, res);
      expect(out).toBeUndefined();
    });
  });

  describe('GET /playground/runs', () => {
    it('resolves the agent first then forwards user+agent to listRuns', async () => {
      listRuns.mockResolvedValue([
        { id: 'r1', prompt: 'p', createdAt: 'now', modelCount: 1, models: ['m'] },
      ]);

      const out = await controller.listRuns(USER, { agentName: 'demo' });

      expect(resolveAgent).toHaveBeenCalledWith('user-1', 'demo');
      expect(listRuns).toHaveBeenCalledWith('user-1', 'agent-1');
      expect(out).toHaveLength(1);
    });
  });

  describe('GET /playground/runs/:runId', () => {
    it('passes the resolved agentId through to the history lookup', async () => {
      getRun.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        createdAt: 'now',
        modelCount: 0,
        models: [],
        columns: [],
      });

      const out = await controller.getRun(USER, { runId: 'r1' }, { agentName: 'demo' });

      expect(resolveAgent).toHaveBeenCalledWith('user-1', 'demo');
      expect(getRun).toHaveBeenCalledWith('user-1', 'r1', 'agent-1');
      expect(out.id).toBe('r1');
    });

    it('propagates errors from the history service', async () => {
      const err = new Error('not found');
      getRun.mockRejectedValue(err);
      await expect(controller.getRun(USER, { runId: 'r1' }, { agentName: 'demo' })).rejects.toBe(
        err,
      );
    });
  });

  describe('PATCH /playground/runs/:runId/star', () => {
    it('toggles the star and returns the new value', async () => {
      toggleStar.mockResolvedValue(true);

      const out = await controller.toggleStar(USER, { runId: 'r1' });

      expect(toggleStar).toHaveBeenCalledWith('user-1', 'r1');
      expect(out).toEqual({ starred: true });
    });
  });

  describe('PATCH /playground/runs/:runId/best', () => {
    it('sets the best column and returns the resolved id', async () => {
      setBestColumn.mockResolvedValue('col-9');

      const out = await controller.setBest(USER, { runId: 'r1' }, { columnId: 'col-9' });

      expect(setBestColumn).toHaveBeenCalledWith('user-1', 'r1', 'col-9');
      expect(out).toEqual({ bestColumnId: 'col-9' });
    });

    it('clears the best column when columnId is null', async () => {
      setBestColumn.mockResolvedValue(null);

      const out = await controller.setBest(USER, { runId: 'r1' }, { columnId: null });

      expect(setBestColumn).toHaveBeenCalledWith('user-1', 'r1', null);
      expect(out).toEqual({ bestColumnId: null });
    });

    it('propagates NotFound from the history service', async () => {
      const err = new Error('cross-run');
      setBestColumn.mockRejectedValue(err);
      await expect(controller.setBest(USER, { runId: 'r1' }, { columnId: 'bad' })).rejects.toBe(
        err,
      );
    });
  });
});

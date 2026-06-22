import { Test, type TestingModule } from '@nestjs/testing';
import type { Response as ExpressResponse } from 'express';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { PlaygroundHistoryService } from './playground-history.service';
import { PlaygroundAgentService } from './playground-agent.service';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';
import type { RunPlaygroundDto } from './dto/run-playground.dto';

const CTX: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };

const AGENT = { id: 'agent-1', tenant_id: 'tenant-1', name: 'Playground' };

describe('PlaygroundController', () => {
  let controller: PlaygroundController;
  let runStream: jest.Mock;
  let listRuns: jest.Mock;
  let getRun: jest.Mock;
  let toggleStar: jest.Mock;
  let setBestColumn: jest.Mock;
  let playgroundAgentResolve: jest.Mock;

  beforeEach(async () => {
    runStream = jest.fn();
    listRuns = jest.fn();
    getRun = jest.fn();
    toggleStar = jest.fn();
    setBestColumn = jest.fn();
    playgroundAgentResolve = jest.fn().mockResolvedValue(AGENT);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaygroundController],
      providers: [
        { provide: PlaygroundService, useValue: { runStream } },
        {
          provide: PlaygroundHistoryService,
          useValue: { listRuns, getRun, toggleStar, setBestColumn },
        },
        {
          provide: PlaygroundAgentService,
          useValue: { resolve: playgroundAgentResolve },
        },
      ],
    }).compile();

    controller = module.get(PlaygroundController);
  });

  describe('POST /playground/run', () => {
    it('delegates to PlaygroundService.runStream with the tenant context, dto and response', async () => {
      const dto = {
        model: 'openai/gpt-4o-mini',
        provider: 'openai',
        messages: [{ role: 'user', content: 'hi' }],
      } as unknown as RunPlaygroundDto;
      const res = {} as ExpressResponse;
      runStream.mockResolvedValue(undefined);

      const out = await controller.run(CTX, dto, res);

      expect(runStream).toHaveBeenCalledWith(CTX, dto, res);
      expect(out).toBeUndefined();
    });
  });

  describe('GET /playground/runs', () => {
    it('resolves the agent first then forwards its tenant+agent to listRuns', async () => {
      listRuns.mockResolvedValue([
        { id: 'r1', prompt: 'p', createdAt: 'now', modelCount: 1, models: ['m'] },
      ]);

      const out = await controller.listRuns(CTX);

      expect(playgroundAgentResolve).toHaveBeenCalledWith(CTX);
      expect(listRuns).toHaveBeenCalledWith('tenant-1', 'agent-1');
      expect(out).toHaveLength(1);
    });
  });

  describe('GET /playground/runs/:runId', () => {
    it('passes the resolved tenant+agentId through to the history lookup', async () => {
      getRun.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        createdAt: 'now',
        modelCount: 0,
        models: [],
        columns: [],
      });

      const out = await controller.getRun(CTX, { runId: 'r1' });

      expect(playgroundAgentResolve).toHaveBeenCalledWith(CTX);
      expect(getRun).toHaveBeenCalledWith('tenant-1', 'r1', 'agent-1');
      expect(out.id).toBe('r1');
    });

    it('propagates errors from the history service', async () => {
      const err = new Error('not found');
      getRun.mockRejectedValue(err);
      await expect(controller.getRun(CTX, { runId: 'r1' })).rejects.toBe(err);
    });
  });

  describe('PATCH /playground/runs/:runId/star', () => {
    it('toggles the star and returns the new value', async () => {
      toggleStar.mockResolvedValue(true);

      const out = await controller.toggleStar(CTX, { runId: 'r1' });

      expect(toggleStar).toHaveBeenCalledWith('tenant-1', 'r1');
      expect(out).toEqual({ starred: true });
    });
  });

  describe('PATCH /playground/runs/:runId/best', () => {
    it('sets the best column and returns the resolved id', async () => {
      setBestColumn.mockResolvedValue('col-9');

      const out = await controller.setBest(CTX, { runId: 'r1' }, { columnId: 'col-9' });

      expect(setBestColumn).toHaveBeenCalledWith('tenant-1', 'r1', 'col-9');
      expect(out).toEqual({ bestColumnId: 'col-9' });
    });

    it('clears the best column when columnId is null', async () => {
      setBestColumn.mockResolvedValue(null);

      const out = await controller.setBest(CTX, { runId: 'r1' }, { columnId: null });

      expect(setBestColumn).toHaveBeenCalledWith('tenant-1', 'r1', null);
      expect(out).toEqual({ bestColumnId: null });
    });

    it('propagates NotFound from the history service', async () => {
      const err = new Error('cross-run');
      setBestColumn.mockRejectedValue(err);
      await expect(controller.setBest(CTX, { runId: 'r1' }, { columnId: 'bad' })).rejects.toBe(err);
    });
  });
});
